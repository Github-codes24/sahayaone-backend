/**
 * cibilPdf.service.js
 *
 * Converts a CIBIL/CAIS-style credit-report JSON object into a styled PDF
 * that mirrors the boxed/tabular "CreditSearch"-style report layout.
 *
 * Ported from generate_credit_report_pdf.py (wkhtmltopdf/HTML) to
 * PDFKit (programmatic drawing), with Sahayaone + Society co-branding.
 */

import PDFDocument from 'pdfkit';
import { logger } from '../../../../utils/logger.util.js';

/* ==========================================================================
 * LOOKUP TABLES  (TransUnion CIBIL numeric codes -> human-readable labels)
 * ==========================================================================*/

const ACCOUNT_TYPE_MAP = {
    '01': 'Auto Loan',
    '02': 'Housing Loan',
    '03': 'Property Loan',
    '04': 'Loan Against Shares',
    '05': 'Personal Loan',
    '06': 'Consumer Loan',
    '07': 'Gold Loan',
    '08': 'Education Loan',
    '09': 'Loan to Professional',
    '10': 'Credit Card',
    '13': 'Leasing',
    '14': 'Overdraft',
    '15': 'Two-Wheeler Loan',
    '16': 'Non-Funded Credit Facility',
    '31': 'Secured Credit Card',
    '32': 'Used Car Loan',
    '33': 'Construction Equipment Loan',
    '34': 'Tractor Loan',
    '35': 'Corporate Credit Card',
    '36': 'Kisan Credit Card',
    '37': 'Business Loan (General)',
    '39': 'Business Loan General',
    '51': 'Business Non-Funded Facility',
    '52': 'Business Funded Facility',
    '99': 'Other Loan',
};

const ACCOUNT_STATUS_MAP = {
    '00': 'New',
    '11': 'Standard / Active',
    '13': 'Closed',
    '21': 'Delinquent 30+',
    '31': 'Delinquent 60+',
    '41': 'Delinquent 90+',
    '43': 'Suit Filed',
    '71': 'Settled',
    '78': 'Written Off',
    '82': 'Restructured',
    '83': 'Restructured Govt Mandate',
    '89': 'Post Write-Off Settled',
};

const PORTFOLIO_TYPE_MAP = {
    R: 'Revolving',
    I: 'Installment',
    M: 'Mortgage',
    O: 'Others',
};

const STATE_CODE_MAP = {
    '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
    '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
    '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
    '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
    '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
    '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
    '24': 'Gujarat', '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli',
    '27': 'Maharashtra', '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa',
    '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
    '35': 'Andaman & Nicobar', '36': 'Telangana', '37': 'Ladakh',
};

const GENDER_MAP = { '1': 'Male', '2': 'Female', '3': 'Other' };

const COUNTRY_CODE_MAP = {
    'IB': 'India',
    'US': 'United States',
    'GB': 'United Kingdom',
    'AE': 'UAE',
    'SG': 'Singapore',
    'AU': 'Australia',
    'CA': 'Canada',
};

const ENQUIRY_REASON_MAP = {
    '00': 'Unknown',
    '01': 'Credit Card',
    '02': 'Housing Loan',
    '03': 'Loan Against Property',
    '04': 'Loan Against Shares',
    '05': 'Personal Loan',
    '06': 'Consumer Loan',
    '07': 'Gold Loan',
    '08': 'Education Loan',
    '09': 'Loan to Professional',
    '10': 'Vehicle Loan',
    '11': 'Overdraft',
    '12': 'Business Loan',
    '13': 'Agriculture Loan',
    '14': 'Review / Monitoring',
    '15': 'Account Review',
    '16': 'Guarantor',
    '17': 'Pre-Approved Offer',
    '18': 'KYC Verification',
    '6':  'Consumer Loan',
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/* ==========================================================================
 * COLOUR PALETTE
 * ==========================================================================*/

const C = {
    primary:   '#1b3a63',   // exact match for the screenshot
    secondary: '#1b3a63',
    accent:    '#C09637',   
    text:      '#000000',
    muted:     '#718096',
    border:    '#A0AEC0',
    bgLight:   '#F7FAFC',
    bgAlt:     '#EEF2F7',   
    good:      '#2F855A',   
    warn:      '#D69E2E',   
    bad:       '#C53030',   
    white:     '#FFFFFF',
};

/* ==========================================================================
 * SMALL FORMATTING HELPERS
 * ==========================================================================*/

function fmtDate(val) {
    if (!val) return '--';
    const s = String(val).trim();
    if (/^\d{8}$/.test(s)) {
        const yyyy = s.slice(0, 4), mm = s.slice(4, 6), dd = s.slice(6, 8);
        return `${yyyy}-${mm}-${dd}`;
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${mm}-${dd}`;
    }
    return s;
}

function fmtTime(val) {
    if (!val) return '--';
    const s = String(val).trim().padStart(6, '0');
    if (/^\d{6}$/.test(s)) {
        return `${s.slice(0, 2)}:${s.slice(2, 4)}:${s.slice(4, 6)}`;
    }
    return s;
}

function fmtMoney(val) {
    if (val === null || val === undefined || val === '' || val === '0') return '--';
    const n = parseFloat(val);
    if (isNaN(n)) return '--';
    return `INR. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/-`;
}

function safe(val) {
    if (val === null || val === undefined) return '--';
    const s = String(val).trim();
    return s || '--';
}

function lookup(code, map) {
    if (!code) return '--';
    return map[String(code)] || `Code ${code}`;
}

/* ==========================================================================
 * DATA PARSING
 * ==========================================================================*/

function parseBureauData(creditReport, requestDetails) {
    let root = creditReport || {};
    if (root.data) root = root.data;
    const crObj  = root.creditReport || root.credit_report || root;
    const bureau = crObj.report || root.report || crObj;

    const hdr = bureau.CreditProfileHeader || {};
    const header = {
        memberName:  requestDetails.memberName || 'Member Institution',
        reportDate:  fmtDate(hdr.ReportDate || requestDetails.createdAt || new Date()),
        reportTime:  fmtTime(hdr.ReportTime),
        reportType:  hdr.Version || 'Combo Report',
        reportNo:    hdr.ReportNumber || requestDetails.requestId || 'N/A',
        referenceId: root.reference_id || crObj.reference_id || requestDetails.requestId || '--',
        version:     safe(hdr.Version),
    };

    const appDetails   = bureau.Current_Application?.Current_Application_Details || {};
    const applicantRaw = appDetails.Current_Applicant_Details || {};
    const addrRaw      = appDetails.Current_Applicant_Address_Details || {};
    const otherRaw     = appDetails.Current_Other_Details || {};

    const constructedName = [
        applicantRaw.First_Name,
        applicantRaw.Middle_Name1,
        applicantRaw.Middle_Name2,
        applicantRaw.Middle_Name3,
        applicantRaw.Last_Name,
    ].filter(Boolean).join(' ').trim();

    const stateName   = STATE_CODE_MAP[addrRaw.State] || addrRaw.State || '';
    const countryName = COUNTRY_CODE_MAP[addrRaw.Country_Code] || addrRaw.Country_Code || 'India';
    const addrLine    = [
        addrRaw.FlatNoPlotNoHouseNo, addrRaw.BldgNoSocietyName,
        addrRaw.RoadNoNameAreaLocality, addrRaw.Landmark,
        addrRaw.City, stateName, addrRaw.PINCode,
        countryName
    ].filter(Boolean).join(', ').trim() || 'N/A';

    const applicant = {
        fullName:             crObj.name || constructedName || requestDetails.fullName || root.name || 'N/A',
        pan:                  crObj.pan  || applicantRaw.IncomeTaxPan || requestDetails.pan || root.pan || 'N/A',
        dob:                  fmtDate(applicantRaw.Date_Of_Birth_Applicant || requestDetails.dob),
        mobile:               crObj.mobile || applicantRaw.MobilePhoneNumber || requestDetails.mobile || root.mobile || 'N/A',
        telephone:            applicantRaw.Telephone_Number_Applicant_1st || 'N/A',
        email:                applicantRaw.EMailId || 'N/A',
        gender:               GENDER_MAP[applicantRaw.Gender_Code] || 'N/A',
        address:              addrLine,
        // Identity documents
        passportNo:           applicantRaw.Passport_Number || 'N/A',
        passportIssue:        fmtDate(applicantRaw.Passport_Issue_Date) === '--' ? 'N/A' : fmtDate(applicantRaw.Passport_Issue_Date),
        passportExpiry:       fmtDate(applicantRaw.Passport_Expiration_Date) === '--' ? 'N/A' : fmtDate(applicantRaw.Passport_Expiration_Date),
        voterId:              applicantRaw.Voter_s_Identity_Card || 'N/A',
        voterIdIssue:         fmtDate(applicantRaw.Voter_ID_Issue_Date) === '--' ? 'N/A' : fmtDate(applicantRaw.Voter_ID_Issue_Date),
        voterIdExpiry:        fmtDate(applicantRaw.Voter_ID_Expiration_Date) === '--' ? 'N/A' : fmtDate(applicantRaw.Voter_ID_Expiration_Date),
        driverLicense:        applicantRaw.Driver_License_Number || 'N/A',
        driverLicenseIssue:   fmtDate(applicantRaw.Driver_License_Issue_Date) === '--' ? 'N/A' : fmtDate(applicantRaw.Driver_License_Issue_Date),
        driverLicenseExpiry:  fmtDate(applicantRaw.Driver_License_Expiration_Date) === '--' ? 'N/A' : fmtDate(applicantRaw.Driver_License_Expiration_Date),
        rationCard:           applicantRaw.Ration_Card_Number || 'N/A',
        rationCardIssue:      fmtDate(applicantRaw.Ration_Card_Issue_Date) === '--' ? 'N/A' : fmtDate(applicantRaw.Ration_Card_Issue_Date),
        rationCardExpiry:     fmtDate(applicantRaw.Ration_Card_Expiration_Date) === '--' ? 'N/A' : fmtDate(applicantRaw.Ration_Card_Expiration_Date),
        universalId:          applicantRaw.Universal_ID_Number || 'N/A',
        universalIdIssue:     fmtDate(applicantRaw.Universal_ID_Issue_Date) === '--' ? 'N/A' : fmtDate(applicantRaw.Universal_ID_Issue_Date),
        universalIdExpiry:    fmtDate(applicantRaw.Universal_ID_Expiration_Date) === '--' ? 'N/A' : fmtDate(applicantRaw.Universal_ID_Expiration_Date),
    };

    // Enquiry / current application fields
    const enquiry = {
        reason:          ENQUIRY_REASON_MAP[appDetails.Enquiry_Reason] || safe(appDetails.Enquiry_Reason),
        financePurpose:  safe(appDetails.Finance_Purpose),
        amountFinanced:  appDetails.Amount_Financed && appDetails.Amount_Financed !== '0'
                            ? fmtMoney(appDetails.Amount_Financed)
                            : '--',
        duration:        appDetails.Duration_Of_Agreement && appDetails.Duration_Of_Agreement !== '0'
                            ? `${appDetails.Duration_Of_Agreement} months`
                            : '--',
    };

    // Current_Other_Details
    const otherDetails = {
        income:           otherRaw.Income && otherRaw.Income !== '0' ? fmtMoney(otherRaw.Income) : '--',
        maritalStatus:    safe(otherRaw.Marital_Status),
        employmentStatus: safe(otherRaw.Employment_Status),
        timeWithEmployer: safe(otherRaw.Time_with_Employer),
        creditCardCount:  safe(otherRaw.Number_of_Major_Credit_Card_Held),
    };

    const scoreRaw = crObj.credit_score || root.credit_score || bureau.SCORE?.FCIREXScore || bureau.SCORE?.score || crObj.score || root.score;
    const score = Number(scoreRaw) > 0 ? Number(scoreRaw) : null;
    const scoreConfidence = safe(bureau.SCORE?.FCIREXScoreConfidLevel);

    const caisRaw  = bureau.CAIS_Account || {};
    const rawAccts = caisRaw.CAIS_Account_DETAILS || [];
    const acctsArr = Array.isArray(rawAccts) ? rawAccts : [rawAccts];
    const accounts = acctsArr.map(mapAccount);

    const caisSummary = caisRaw.CAIS_Summary || {};
    const acctSummary = caisSummary.Credit_Account || {};
    const balSummary  = caisSummary.Total_Outstanding_Balance || {};

    const summary = {
        totalAccounts:        Number(acctSummary.CreditAccountTotal  || accounts.length),
        activeAccounts:       Number(acctSummary.CreditAccountActive  || accounts.filter(a => a.status.includes('Active') || a.status.includes('Standard')).length),
        closedAccounts:       Number(acctSummary.CreditAccountClosed  || accounts.filter(a => a.status === 'Closed').length),
        defaultAccounts:      Number(acctSummary.CreditAccountDefault || accounts.filter(a => a.amountOverdueRaw > 0).length),
        outstandingAll:       fmtMoney(balSummary.Outstanding_Balance_All),
        outstandingSecured:   fmtMoney(balSummary.Outstanding_Balance_Secured),
        outstandingUnsecured: fmtMoney(balSummary.Outstanding_Balance_UnSecured),
        securedPct:           safe(balSummary.Outstanding_Balance_Secured_Percentage),
        unsecuredPct:         safe(balSummary.Outstanding_Balance_UnSecured_Percentage),
    };

    // CAPS / Enquiry history
    const totalCaps    = bureau.TotalCAPS_Summary || {};
    const capsObj      = bureau.CAPS || {};
    const nonCreditObj = bureau.NonCreditCAPS || {};
    const capsSummary  = capsObj.CAPS_Summary || {};
    const nonCreditSum = nonCreditObj.NonCreditCAPS_Summary || {};
    const capsApps     = Array.isArray(capsObj.CAPS_Application_Details)
                            ? capsObj.CAPS_Application_Details
                            : [];
    const ncCapsApps   = Array.isArray(nonCreditObj.CAPS_Application_Details)
                            ? nonCreditObj.CAPS_Application_Details
                            : [];

    const caps = {
        total: {
            last7:   safe(totalCaps.TotalCAPSLast7Days),
            last30:  safe(totalCaps.TotalCAPSLast30Days),
            last90:  safe(totalCaps.TotalCAPSLast90Days),
            last180: safe(totalCaps.TotalCAPSLast180Days),
        },
        credit: {
            last7:   safe(capsSummary.CAPSLast7Days),
            last30:  safe(capsSummary.CAPSLast30Days),
            last90:  safe(capsSummary.CAPSLast90Days),
            last180: safe(capsSummary.CAPSLast180Days),
        },
        nonCredit: {
            last7:   safe(nonCreditSum.NonCreditCAPSLast7Days),
            last30:  safe(nonCreditSum.NonCreditCAPSLast30Days),
            last90:  safe(nonCreditSum.NonCreditCAPSLast90Days),
            last180: safe(nonCreditSum.NonCreditCAPSLast180Days),
        },
        applications: [...capsApps, ...ncCapsApps],
    };

    return { header, applicant, enquiry, otherDetails, score, scoreConfidence, accounts, summary, caps };
}

function mapAccount(acc) {
    const typeCode   = String(acc.Account_Type || '').padStart(2, '0');
    const statusCode = String(acc.Account_Status || '').padStart(2, '0');

    let statusLabel = ACCOUNT_STATUS_MAP[statusCode] || 'Standard / Active';
    if (acc.Date_Closed && String(acc.Date_Closed).trim()) statusLabel = 'Closed';

    const portfolio = lookup(acc.Portfolio_Type, PORTFOLIO_TYPE_MAP);

    const history = (acc.CAIS_Account_History || []).slice().sort((a, b) => {
        if (a.Year !== b.Year) return Number(a.Year) - Number(b.Year);
        return Number(a.Month) - Number(b.Month);
    });

    function dpdCell(dpd, cls) {
        if ((dpd === '' || dpd === null || dpd === undefined) &&
            (cls === '' || cls === null || cls === undefined || cls === '?')) return '';
        const n = Number(dpd);
        if (cls === 'S' && (n === 0 || isNaN(n))) return '000';
        if (!isNaN(n) && n > 0) {
            return `${n}+`;
        }
        if (!isNaN(n) && n === 0) return '000';
        return cls || '';
    }

    const byYear = {};

    history.forEach(h => {
        const yr = Number(h.Year);
        const mo = Number(h.Month);
        if (!yr || mo < 1 || mo > 12) return;
        if (!byYear[yr]) byYear[yr] = new Array(12).fill('');
        const code = dpdCell(h.Days_Past_Due, h.Asset_Classification);
        byYear[yr][mo - 1] = code;
    });

    const emiGrid = Object.keys(byYear)
        .sort((a, b) => Number(b) - Number(a))
        .map(yr => ({ year: yr, cells: byYear[yr] }));

    return {
        subscriberName:   safe(acc.Subscriber_Name) === '--' ? 'Financial Institution' : safe(acc.Subscriber_Name),
        accountNumber:    acc.Account_Number ? String(acc.Account_Number).replace(/^X+/, 'XXXX') : 'N/A',
        accountType:      ACCOUNT_TYPE_MAP[typeCode] || `Type ${typeCode}`,
        portfolio,
        status:           statusLabel,
        openDate:         fmtDate(acc.Open_Date),
        reportedDate:     fmtDate(acc.Date_Reported),
        closedDate:       acc.Date_Closed ? fmtDate(acc.Date_Closed) : null,
        lastPayment:      fmtDate(acc.Date_of_Last_Payment),
        sanctionAmount:   fmtMoney(acc.Highest_Credit_or_Original_Loan_Amount),
        creditLimit:      fmtMoney(acc.Credit_Limit_Amount),
        currentBalance:   fmtMoney(acc.Current_Balance),
        amountOverdue:    fmtMoney(acc.Amount_Past_Due),
        rateOfInterest:   acc.Rate_of_Interest ? `${acc.Rate_of_Interest}%` : '--',
        tenure:           safe(acc.Terms_Duration || acc.Repayment_Tenure),
        emiGrid,
        amountOverdueRaw: Number(acc.Amount_Past_Due || 0),
    };
}

/* ==========================================================================
 * PDF GENERATION SERVICE
 * ==========================================================================*/

export class CreditSearchStylePdfService {
    async generatePdf({ requestDetails = {}, creditReport = {} }) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });

                const buffers = [];
                doc.on('data', chunk => buffers.push(chunk));
                doc.on('end',  () => resolve(Buffer.concat(buffers)));
                doc.on('error', err => reject(err));

                const data = parseBureauData(creditReport, requestDetails);

                /* Layout constants */
                const L  = 36;
                const W  = 523;
                const PB = 806;
                let y    = 36;

                const checkBreak = (needed) => {
                    if (y + needed > PB - 40) { doc.addPage(); y = 36; }
                };

                /* Filled rectangle helper */
                const drawRect = (rx, ry, rw, rh, fill, stroke) => {
                    if (fill) {
                        doc.rect(rx, ry, rw, rh).fill(fill);
                    }
                    if (stroke) {
                        doc.rect(rx, ry, rw, rh).strokeColor(stroke).lineWidth(0.5).stroke();
                    }
                };

                /* Single-line text */
                const txt = (text, tx, ty, opts = {}) => {
                    const { w = 200, size = 7.5, color = C.text, bold = false, align = 'left', lineBreak = false } = opts;
                    doc.fontSize(size)
                       .fillColor(color)
                       .font(bold ? 'Helvetica-Bold' : 'Helvetica')
                       .text(String(text != null ? text : '--'), tx, ty, { width: w, align, lineBreak });
                };

                /* Section title bar */
                const sectionBar = (title) => {
                    checkBreak(24);
                    // Light blue bar at the top with left border
                    doc.rect(L, y, 4, 18).fill(C.primary);
                    doc.rect(L + 4, y, W - 4, 18).fill('#E2E8F0');
                    txt(title, L + 10, y + 5, { w: W - 14, size: 8.5, color: C.primary, bold: true });
                    y += 20;
                };

                /* Key-value row: pairs = [[label, value], ...], colW = width per pair */
                const kvRow = (pairs, colW, rowH = 18) => {
                    checkBreak(rowH);
                    let x = L;
                    pairs.forEach(([label, value]) => {
                        if (!label) return;
                        const labelW = colW * 0.40;
                        const valW = colW * 0.60;
                        drawRect(x, y, labelW, rowH, C.white, C.border);
                        txt(label, x + 6, y + 5, { w: labelW - 10, size: 7.5, color: C.primary, bold: true });
                        drawRect(x + labelW, y, valW, rowH, C.white, C.border);
                        txt(value || '--', x + labelW + 6, y + 5, { w: valW - 10, size: 7.5, color: C.text });
                        x += colW;
                    });
                    y += rowH;
                };

                /* Table header */
                const tableHeader = (cols) => {
                    const rowH = 18;
                    checkBreak(rowH);
                    drawRect(L, y, W, rowH, C.primary);
                    cols.forEach(col => {
                        txt(col.label, col.x, y + 5, { w: col.w, size: 7.5, color: C.white, bold: true, align: col.align || 'center' });
                    });
                    y += rowH;
                };

                /* Table data row */
                const tableRow = (cols, rowIdx) => {
                    const rowH = 18;
                    checkBreak(rowH);
                    const bg = C.white;
                    drawRect(L, y, W, rowH, bg, C.border);
                    cols.forEach(col => {
                        txt(col.value != null ? col.value : '--', col.x, y + 5,
                            { w: col.w, size: 7.5, color: col.color || C.text, align: col.align || 'center' });
                    });
                    y += rowH;
                };

                /* =========================================================
                 * 0. BRANDING HEADER (Sahayaone + Society)
                 * =========================================================*/
                drawRect(L, y, W, 42, C.primary);
                // Sahayaone wordmark (left)
                txt('SAHAYAONE', L + 8, y + 6, { w: 200, size: 18, color: C.accent, bold: true });
                txt('Enterprise Loan Management System', L + 8, y + 27, { w: 260, size: 7, color: '#A0AEC0' });
                // Society / member name (right)
                txt(data.header.memberName, L + 270, y + 6, { w: W - 278, size: 11, color: C.white, bold: true, align: 'right' });
                txt('Credit Information Report', L + 270, y + 22, { w: W - 278, size: 7, color: '#A0AEC0', align: 'right' });
                txt(
                    `Report No. ${data.header.reportNo}  |  Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
                    L + 270, y + 34, { w: W - 278, size: 6.5, color: '#90CDF4', align: 'right' }
                );
                y += 50;
                
                // Top header text like in screenshot
                txt('Credit Information Report', L, y, { w: 200, size: 7.5, color: C.muted });
                txt(`Report No. ${data.header.reportNo} | Generated ${data.header.reportDate} 05:15`, L + 200, y, { w: W - 200, size: 7.5, color: C.muted, align: 'right' });
                y += 12;
                
                // Blue banner
                drawRect(L, y, W, 20, C.primary);
                txt(`Credit Information Report — ${data.applicant.fullName}`, L + 8, y + 5, { w: W - 16, size: 10, color: C.white, bold: true });
                y += 24;

                /* =========================================================
                 * 1. ENQUIRY DETAILS
                 * =========================================================*/
                sectionBar('ENQUIRY DETAILS');

                kvRow([['Name', data.applicant.fullName], ['Contact', data.applicant.mobile]], W / 2);
                kvRow([['Gender / DOB', `${data.applicant.gender} / ${data.applicant.dob}`], ['PAN', data.applicant.pan]], W / 2);

                // Address
                {
                    const addrText = data.applicant.address;
                    const addrH = Math.max(18, doc.heightOfString(addrText, { width: (W) * 0.8 - 10 }) + 10);
                    checkBreak(addrH);
                    const labelW = (W / 2) * 0.40;
                    const valW = W - labelW;
                    drawRect(L, y, labelW, addrH, C.white, C.border);
                    txt('Address', L + 6, y + 5, { w: labelW - 10, size: 7.5, color: C.primary, bold: true });
                    drawRect(L + labelW, y, valW, addrH, C.white, C.border);
                    txt(addrText, L + labelW + 6, y + 5, { w: valW - 10, size: 7.5, color: C.text, lineBreak: true });
                    y += addrH;
                }

                // Enquiry sub-details
                kvRow([
                    ['Enquiry Reason',   data.enquiry.reason],
                    ['Finance Purpose',  data.enquiry.financePurpose],
                ], W / 2);
                kvRow([
                    ['Amount Financed',  data.enquiry.amountFinanced],
                    ['Duration',         data.enquiry.duration],
                ], W / 2);

                // Current Other Details
                kvRow([
                    ['Annual Income',    data.otherDetails.income],
                    ['Marital Status',   data.otherDetails.maritalStatus],
                ], W / 2);
                kvRow([
                    ['Employment Status',    data.otherDetails.employmentStatus],
                    ['Credit Cards Held',    data.otherDetails.creditCardCount],
                ], W / 2);

                y += 8;

                /* =========================================================
                 * 1b. IDENTITY DOCUMENTS
                 * =========================================================*/
                sectionBar('IDENTITY DOCUMENTS');

                kvRow([
                    ['Passport No.',       data.applicant.passportNo],
                    ['Passport Issue',     data.applicant.passportIssue],
                ], W / 2);
                kvRow([
                    ['Passport Expiry',    data.applicant.passportExpiry],
                    ['Voter ID',           data.applicant.voterId],
                ], W / 2);
                kvRow([
                    ['Voter ID Issue',     data.applicant.voterIdIssue],
                    ['Voter ID Expiry',    data.applicant.voterIdExpiry],
                ], W / 2);
                kvRow([
                    ['Driver License',     data.applicant.driverLicense],
                    ['DL Issue Date',      data.applicant.driverLicenseIssue],
                ], W / 2);
                kvRow([
                    ['DL Expiry Date',     data.applicant.driverLicenseExpiry],
                    ['Ration Card No.',    data.applicant.rationCard],
                ], W / 2);
                kvRow([
                    ['Ration Card Issue',  data.applicant.rationCardIssue],
                    ['Ration Card Expiry', data.applicant.rationCardExpiry],
                ], W / 2);
                kvRow([
                    ['Universal ID',       data.applicant.universalId],
                    ['UID Issue Date',     data.applicant.universalIdIssue],
                ], W / 2);
                kvRow([
                    ['UID Expiry Date',    data.applicant.universalIdExpiry],
                    ['Telephone',         data.applicant.telephone],
                ], W / 2);

                y += 8;

                /* =========================================================
                 * 2. REPORT DETAILS + CREDIT SCORE BOX
                 * =========================================================*/
                sectionBar('REPORT DETAILS');

                kvRow([['Report Date', data.header.reportDate], ['Report Time', data.header.reportTime]], W / 2);
                kvRow([['Report No.', data.header.reportNo], ['Bureau Version', data.header.version]], W / 2);
                kvRow([['Reference ID', data.header.referenceId], ['', '']], W / 2);

                y += 12;
                checkBreak(70);

                // ── CREDIT SCORE PANEL ───────────────────────────────────────
                checkBreak(110);
                const panelH = 100;
                const scoreBoxW = 160;

                // Panel background
                drawRect(L, y, W, panelH, '#F0F4FF', C.border);

                // Left: dark score box
                drawRect(L, y, scoreBoxW, panelH, C.primary);

                // Score value
                const scoreVal = data.score ? String(data.score) : 'N/A';
                doc.fontSize(38).fillColor(C.accent).font('Helvetica-Bold')
                   .text(scoreVal, L, y + 14, { width: scoreBoxW, align: 'center' });
                doc.fontSize(7.5).fillColor('#A0C4FF').font('Helvetica')
                   .text('FCIREX CREDIT SCORE', L, y + 56, { width: scoreBoxW, align: 'center' });

                // Score label (colour coded)
                const scoreNum = data.score || 0;
                let scoreLabel = 'No History'; let labelColor = C.muted;
                if (scoreNum >= 750) { scoreLabel = 'EXCELLENT';   labelColor = C.good; }
                else if (scoreNum >= 700) { scoreLabel = 'GOOD';   labelColor = '#2B6CB0'; }
                else if (scoreNum >= 650) { scoreLabel = 'FAIR';   labelColor = C.warn; }
                else if (scoreNum >= 300) { scoreLabel = 'POOR';   labelColor = C.bad; }

                doc.fontSize(9).fillColor(labelColor).font('Helvetica-Bold')
                   .text(scoreLabel, L, y + 70, { width: scoreBoxW, align: 'center' });

                // Score confidence level (below label, if available)
                const conf = data.scoreConfidence !== '--' ? data.scoreConfidence : '';
                if (conf) {
                    doc.fontSize(6.5).fillColor('#90CDF4').font('Helvetica')
                       .text(`Confidence: ${conf}`, L, y + 84, { width: scoreBoxW, align: 'center' });
                }

                // Right side: score band bar + CAPS mini-stats
                const rbX = L + scoreBoxW + 10;
                const rbW = W - scoreBoxW - 20;

                // Score range bar (300–900)
                const barY = y + 10;
                const barH = 10;
                const barW = rbW;
                // gradient segments: red, orange, yellow, green
                const segments = [
                    { label: '300',  pct: 0.166, color: '#E53E3E' },
                    { label: '500',  pct: 0.166, color: '#DD6B20' },
                    { label: '600',  pct: 0.084, color: '#D69E2E' },
                    { label: '650',  pct: 0.083, color: '#B7791F' },
                    { label: '700',  pct: 0.083, color: '#48BB78' },
                    { label: '750',  pct: 0.250, color: '#2F855A' },
                    { label: '900',  pct: 0.168, color: '#1A4731' },
                ];
                let segX = rbX;
                segments.forEach(seg => {
                    const sw = barW * seg.pct;
                    doc.rect(segX, barY, sw, barH).fill(seg.color);
                    segX += sw;
                });
                // Score range labels
                txt('300', rbX, barY + barH + 2, { w: 20, size: 5.5, color: C.muted });
                txt('500', rbX + barW * 0.166, barY + barH + 2, { w: 20, size: 5.5, color: C.muted });
                txt('600', rbX + barW * 0.332, barY + barH + 2, { w: 20, size: 5.5, color: C.muted });
                txt('700', rbX + barW * 0.499, barY + barH + 2, { w: 20, size: 5.5, color: C.muted });
                txt('750', rbX + barW * 0.665, barY + barH + 2, { w: 20, size: 5.5, color: C.muted });
                txt('900', rbX + barW * 0.832, barY + barH + 2, { w: 20, size: 5.5, color: C.muted });

                // Marker for actual score
                if (data.score) {
                    const markerPct = Math.min(1, Math.max(0, (data.score - 300) / 600));
                    const markerX = rbX + barW * markerPct - 1;
                    doc.rect(markerX, barY - 2, 2, barH + 4).fill(C.text);
                }

                // CAPS mini-stat chips (2×2 grid)
                const chipY  = barY + barH + 20;
                const chipW  = (rbW - 6) / 4;
                const chipData = [
                    { label: 'Enquiries\nLast 7 Days',   value: data.caps.total.last7 },
                    { label: 'Enquiries\nLast 30 Days',  value: data.caps.total.last30 },
                    { label: 'Enquiries\nLast 90 Days',  value: data.caps.total.last90 },
                    { label: 'Enquiries\nLast 180 Days', value: data.caps.total.last180 },
                ];
                chipData.forEach((chip, ci) => {
                    const cx = rbX + ci * (chipW + 2);
                    drawRect(cx, chipY, chipW, 44, C.white, C.border);
                    drawRect(cx, chipY, chipW, 3, C.accent);
                    doc.fontSize(16).fillColor(C.primary).font('Helvetica-Bold')
                       .text(String(chip.value), cx, chipY + 8, { width: chipW, align: 'center' });
                    doc.fontSize(6).fillColor(C.muted).font('Helvetica')
                       .text(chip.label, cx + 2, chipY + 28, { width: chipW - 4, align: 'center' });
                });

                // Credit vs Non-Credit sub-label
                const subY = chipY + 48;
                txt(`Credit Enquiries (7/30/90/180d): ${data.caps.credit.last7} / ${data.caps.credit.last30} / ${data.caps.credit.last90} / ${data.caps.credit.last180}`,
                    rbX, subY, { w: rbW, size: 6.5, color: C.muted });
                txt(`Non-Credit Enquiries (7/30/90/180d): ${data.caps.nonCredit.last7} / ${data.caps.nonCredit.last30} / ${data.caps.nonCredit.last90} / ${data.caps.nonCredit.last180}`,
                    rbX, subY + 9, { w: rbW, size: 6.5, color: C.muted });

                y += panelH + 14;

                /* =========================================================
                 * 4. ACCOUNTS SUMMARY
                 * =========================================================*/
                sectionBar('ACCOUNTS SUMMARY');

                tableHeader([
                    { label: 'Total Accounts',        x: L,         w: 60, align: 'center' },
                    { label: 'Active',                x: L + 60,    w: 50, align: 'center' },
                    { label: 'Closed',                x: L + 110,   w: 50, align: 'center' },
                    { label: 'Default/Overdue A/Cs',  x: L + 160,   w: 90, align: 'center' },
                    { label: 'Total Outstanding',     x: L + 250,   w: 90, align: 'center' },
                    { label: 'Secured Outstanding',   x: L + 340,   w: 90, align: 'center' },
                    { label: 'Unsecured Outstanding', x: L + 430,   w: 90, align: 'center' },
                ]);

                tableRow([
                    { value: String(data.summary.totalAccounts),   x: L,         w: 60, align: 'center' },
                    { value: String(data.summary.activeAccounts),  x: L + 60,    w: 50, align: 'center' },
                    { value: String(data.summary.closedAccounts),  x: L + 110,   w: 50, align: 'center' },
                    { value: String(data.summary.defaultAccounts), x: L + 160,   w: 90, align: 'center' },
                    { value: data.summary.outstandingAll,          x: L + 250,   w: 90, align: 'center' },
                    { value: `${data.summary.outstandingSecured} (${data.summary.securedPct}%)`,   x: L + 340,   w: 90, align: 'center' },
                    { value: `${data.summary.outstandingUnsecured} (${data.summary.unsecuredPct}%)`, x: L + 430,   w: 90, align: 'center' },
                ], 0);

                y += 12;

                /* =========================================================
                 * 4b. CAPS / ENQUIRY HISTORY
                 * =========================================================*/
                sectionBar('CAPS / ENQUIRY HISTORY');

                // Summary table: 5 columns — Type | Last 7 Days | Last 30 Days | Last 90 Days | Last 180 Days
                const capsColWs = [W * 0.22, W * 0.195, W * 0.195, W * 0.195, W * 0.195];
                checkBreak(16);
                drawRect(L, y, W, 16, C.primary, C.border);
                const capsHdrs = ['Enquiry Type', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'Last 180 Days'];
                let capsCX = L;
                capsHdrs.forEach((h, i) => {
                    txt(h, capsCX + 3, y + 4, { w: capsColWs[i] - 5, size: 7, color: C.white, bold: true, align: 'center' });
                    capsCX += capsColWs[i];
                });
                y += 16;

                const capsRows = [
                    ['Total Enquiries',    data.caps.total.last7,      data.caps.total.last30,      data.caps.total.last90,      data.caps.total.last180],
                    ['Credit Enquiries',   data.caps.credit.last7,     data.caps.credit.last30,     data.caps.credit.last90,     data.caps.credit.last180],
                    ['Non-Credit Enquiries', data.caps.nonCredit.last7, data.caps.nonCredit.last30,  data.caps.nonCredit.last90,  data.caps.nonCredit.last180],
                ];
                capsRows.forEach((row, ri) => {
                    checkBreak(14);
                    const bg = ri % 2 === 0 ? C.white : C.bgLight;
                    drawRect(L, y, W, 14, bg, C.border);
                    let cx2 = L;
                    row.forEach((cell, ci) => {
                        txt(String(cell), cx2 + 3, y + 3, { w: capsColWs[ci] - 5, size: 7, color: C.text, align: 'center' });
                        cx2 += capsColWs[ci];
                    });
                    y += 14;
                });

                // Individual CAPS application entries (if any)
                if (data.caps.applications.length > 0) {
                    y += 8;
                    checkBreak(16);
                    drawRect(L, y, W, 14, '#E2E8F0', C.border);
                    txt('Individual Enquiry Records', L + 6, y + 3, { w: W - 12, size: 7.5, color: C.primary, bold: true });
                    y += 14;

                    const capsAppCols = [
                        { label: 'Subscriber',      wPct: 0.28 },
                        { label: 'Enquiry Purpose', wPct: 0.22 },
                        { label: 'Amount',          wPct: 0.18 },
                        { label: 'Date',            wPct: 0.18 },
                        { label: 'Type',            wPct: 0.14 },
                    ];
                    const capsAppWs = capsAppCols.map(c => W * c.wPct);

                    checkBreak(14);
                    drawRect(L, y, W, 14, C.primary, C.border);
                    let cax = L;
                    capsAppCols.forEach((col, i) => {
                        txt(col.label, cax + 3, y + 3, { w: capsAppWs[i] - 5, size: 6.5, color: C.white, bold: true, align: 'center' });
                        cax += capsAppWs[i];
                    });
                    y += 14;

                    data.caps.applications.forEach((app, ri) => {
                        checkBreak(14);
                        const bg = ri % 2 === 0 ? C.white : C.bgLight;
                        drawRect(L, y, W, 14, bg, C.border);
                        const cells = [
                            safe(app.Subscriber_Name || app.SubscriberName),
                            safe(app.Enquiry_Reason  || app.EnquiryReason || (ENQUIRY_REASON_MAP[app.Enquiry_Reason] || app.Enquiry_Reason)),
                            fmtMoney(app.Amount_Financed || app.AmountFinanced || app.Finance_Amount),
                            fmtDate(app.Date_of_Request || app.DateOfRequest || app.Enquiry_Date),
                            safe(app.Type_of_Enquiry   || app.TypeOfEnquiry  || app.Enquiry_Type),
                        ];
                        let cax2 = L;
                        cells.forEach((cell, ci) => {
                            txt(cell, cax2 + 3, y + 3, { w: capsAppWs[ci] - 5, size: 6.5, color: C.text, align: 'center' });
                            cax2 += capsAppWs[ci];
                        });
                        y += 14;
                    });
                }

                y += 12;

                /* =========================================================
                 * 5. ACCOUNT DETAILS
                 * =========================================================*/
                sectionBar('ACCOUNT DETAILS');

                if (data.accounts.length === 0) {
                    checkBreak(24);
                    drawRect(L, y, W, 22, C.bgLight, C.border);
                    txt('No credit account records found.', L + 8, y + 7, { w: W - 16, size: 8, color: C.muted });
                    y += 30;
                } else {
                    data.accounts.forEach(acc => {
                        // Account header bar
                        checkBreak(18);
                        drawRect(L, y, W, 18, C.primary);
                        txt(
                            `${acc.subscriberName} — ${acc.accountType} (${acc.portfolio})`,
                            L + 6, y + 5, { w: 340, size: 8, color: C.white, bold: true }
                        );
                        txt(`A/C: ${acc.accountNumber}`, L + 350, y + 5,
                            { w: W - 356, size: 8, color: C.white, bold: true, align: 'right' });
                        y += 18;

                        // Financial detail grid (2-column key-value pairs)
                        const finPairs = [
                            ['Opened',                   acc.openDate],
                            ['Status',                   acc.status],
                            ['Sanctioned / High Credit', acc.sanctionAmount],
                            ['Credit Limit',             acc.creditLimit],
                            ['Current Balance',          acc.currentBalance],
                            ['Amount Past Due',          acc.amountOverdue],
                            ['Rate of Interest',         acc.rateOfInterest],
                            ['Tenure (months)',          acc.tenure],
                            ['Date Reported',            acc.reportedDate],
                            ['Last Payment',             acc.lastPayment],
                        ];

                        const colW2 = W / 2;
                        for (let i = 0; i < finPairs.length; i += 2) {
                            kvRow([finPairs[i], finPairs[i + 1]], colW2, 18);
                        }

                        // EMI grid
                        if (acc.emiGrid.length > 0) {
                            checkBreak(22);
                            txt('Payment History (DPD / Asset Classification)',
                                L, y + 8, { w: W, size: 8, color: C.text, bold: true });
                            y += 20;

                            const yearColW  = 60;
                            const monthColW = (W - yearColW) / 12;

                            // Month header
                            checkBreak(14);
                            drawRect(L, y, W, 14, C.primary);
                            
                            MONTHS.forEach((m, idx) => {
                                txt(m, L + yearColW + idx * monthColW, y + 3,
                                    { w: monthColW, size: 7, color: C.white, bold: true, align: 'center' });
                            });
                            y += 14;

                            // Year rows
                            acc.emiGrid.forEach((row, rIdx) => {
                                checkBreak(14);
                                drawRect(L, y, W, 14, C.white, C.border);
                                // cell dividers
                                for(let i=0; i<12; i++) {
                                    doc.moveTo(L + yearColW + i * monthColW, y).lineTo(L + yearColW + i * monthColW, y + 14).strokeColor(C.border).lineWidth(0.5).stroke();
                                }
                                txt(String(row.year), L, y + 3,
                                    { w: yearColW, size: 7.5, color: C.text, bold: true, align: 'center' });
                                row.cells.forEach((cell, idx) => {
                                    txt(cell, L + yearColW + idx * monthColW, y + 3,
                                        { w: monthColW, size: 7, color: C.text, align: 'center' });
                                });
                                y += 14;
                            });
                        }
                        y += 16;
                    });
                }

                /* =========================================================
                 * X. NOTES / MORE INFORMATION PAGE
                 * =========================================================*/
                doc.addPage();
                y = 36;
                // Center Title
                doc.fontSize(16).fillColor('#43934B').font('Helvetica-Bold') // Greenish color
                   .text('NOTES / MORE INFORMATION', L, y, { width: W, align: 'center' });
                y += 20;
                doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#43934B').lineWidth(1).stroke();
                y += 10;

                doc.fontSize(10).fillColor(C.text).font('Helvetica-Bold').text('A. General Information', L, y);
                y += 14;
                doc.fontSize(8.5).fillColor(C.text).font('Helvetica');
                const genInfo = [
                    '1. The Report is Generated Based on the Information provided by the Financial Institution to the Bureau. If you find any errors in the Report, Pls. contact the Bank or Credit Bureau to Rectify the Errors.',
                    '2. The Report is Fetched directly from the Credit Bureau and No Changes in the Data have been Made by Sahayaone Enterprise Loan Management System.',
                    '3. It may occur that some Lenders (Small Percentage of Credit Lenders) do not Submit Credit Data to the Some Bureau. Sahayaone is not Responsible and cannot force the Lender to Submit the Data to the Bureau. So, exercise caution while making lending Decisions.',
                    '4. For More Details and to Resolve your Doubts, Pls. refer the Questions (FAQ) Section of the Information Menu. If you still have any other Query, Pls. contact us @ +91 8989 46 8686.'
                ];
                genInfo.forEach(text => {
                    const h = doc.heightOfString(text, { width: W }) + 4;
                    doc.text(text, L, y, { width: W, lineBreak: true });
                    y += h;
                });
                y += 10;

                doc.fontSize(10).fillColor(C.text).font('Helvetica-Bold').text('B. Credit Score FAQ\'S', L, y);
                y += 14;
                doc.fontSize(8.5).fillColor(C.text).font('Helvetica');
                const faqInfo = [
                    '1. A Credit Score is a 3-digit number that represents the creditworthiness of an Individual. It typically ranges between 300 and 900, 900 being the highest score possible. Banks and various regulated Lending Institutions check your credit score when you apply for a loan.',
                    '2. The Credit Score ranges and its Broad Meaning are as Mentioned',
                    '   • -1 - 12      : there is no Credit History or the Credit History Available is not sufficient to calculate a Score.',
                    '   • 300 - 499 : Very Poor, Immediate Action is Required',
                    '   • 500 - 600 : Poor, Immediate Action is Required',
                    '   • 600 - 649 : Doubtful',
                    '   • 650 - 699 : Fair',
                    '   • 700 - 749 : Good',
                    '   • 750 - 900 : Excellent',
                    '3. The Credit Scores of Retail and MFI are Different and Account Histories of Either do not Affect Each Other.',
                    '4. The Credit Score of Each Bureau is Different as each bureau have Different Algorithms to Calculate the Credit.',
                    '5. The Credit Scores of Bureaus may also differ as some consider Credit History of 24 Months, Some Consider Credit History of 36 Months, while some Consider Credit History of 48 Months while Calculating the Credit Score.'
                ];
                faqInfo.forEach(text => {
                    const h = doc.heightOfString(text, { width: W }) + 4;
                    doc.text(text, L, y, { width: W, lineBreak: true });
                    y += h;
                });
                y += 10;

                /* =========================================================
                 * NOTATION MEANINGS TABLE (last page)
                 * =========================================================*/
                checkBreak(28);
                // Section title bar
                doc.rect(L, y, 4, 18).fill(C.primary);
                doc.rect(L + 4, y, W - 4, 18).fill('#E2E8F0');
                txt('Notation Meanings', L + 10, y + 5, { w: W - 14, size: 8.5, color: C.primary, bold: true });
                y += 20;

                // Two-panel layout: left half and right half, each with Notation | Meaning columns
                const nmData = [
                    ['N',       'Value not available'],
                    ['S',       'Asset Classification is Standard'],
                    ['000',     'Current account'],
                    ['RES',     'Restructured Loan'],
                    ['CLSD',    'Paid or closed account / zero balance'],
                    ['RGM',     'Restructured Loan - Govt Mandate'],
                    ['NEW',     'New Account'],
                    ['SET',     'Settled'],
                    ['LNSB',    'Loan Submitted'],
                    ['SUB, B',  'Asset Classification is Substandard — Assets which has remained NPA for a period less than or equal to 12 months'],
                    ['LAND',    'Loan Approved, Not Yet Disbursed'],
                    ['DBT, D',  'Asset Classification is Doubtful — An asset is classified as doubtful if it has remained in the substandard category for a period of 12 months'],
                    ['INAC',    'Account is Inactive'],
                    ['SPM, M',  'Asset Classification is Special Mention Account — If an instalment is overdue by a period of 30 days, the borrower\'s account is classified as SMA-1'],
                    ['CON',     'Contact Member for Status'],
                    ['L',       'Asset Classification is Loss — A loss asset is one where loss has been identified by the bank or internal or external auditors or RBI'],
                    ['0, 01+',  '0–29 days past the due date'],
                    ['*, ?',    'Days Past Due and Asset Classification both are not reported. "?" may be embedded in the payment pattern'],
                    ['1, 31+',  '30–59 days past the due date'],
                    ['FPD',     'First Payment Default'],
                    ['2, 61+',  '60–89 days past the due date'],
                    ['WOF',     'Charge Off / Written Off'],
                    ['3, 91+',  '90–119 days past the due date'],
                    ['WDF',     'Wilful Default'],
                    ['4, 121+', '120–149 days past the due date'],
                    ['SF',      'Suit Filed'],
                    ['5, 121+', '150–179 days past the due date'],
                    ['SFWD',    'Suit Filed, Wilful Default'],
                    ['6, 181+', '180 or more days past the due'],
                    ['SFWO',    'Suit Filed and Written Off'],
                    ['DEC',     'Loan Declined'],
                    ['WDWO',    'Wilful Default and Written Off'],
                    ['PWOS',    'Post Written Off Settled'],
                    ['SWDW',    'Suit Filed, Wilful Default, and Written Off'],
                    ['DIS',     'Dispute Resolution Pending'],
                    ['BK',      'Included in Bankruptcy'],
                    ['CUF',     'Closed Account / Unpaid Final Bill'],
                    ['LOSS',    'Asset Quality is Loss'],
                ];

                // Split into two vertical panels side-by-side
                const midIdx   = Math.ceil(nmData.length / 2);
                const leftCol  = nmData.slice(0, midIdx);
                const rightCol = nmData.slice(midIdx);

                // Column widths: each half = W/2; within each half: notation 22%, meaning 78%
                const halfW   = W / 2;
                const nmNotW  = halfW * 0.22;
                const nmMeanW = halfW * 0.78;
                const maxRows = Math.max(leftCol.length, rightCol.length);

                // Table header for both panels
                checkBreak(16);
                // Left header
                drawRect(L,            y, nmNotW,  16, C.primary, C.border);
                drawRect(L + nmNotW,   y, nmMeanW, 16, C.primary, C.border);
                txt('Notation', L + 3,          y + 4, { w: nmNotW  - 5, size: 7, color: C.white, bold: true });
                txt('Meaning',  L + nmNotW + 3, y + 4, { w: nmMeanW - 5, size: 7, color: C.white, bold: true });
                // Right header
                const rx0 = L + halfW;
                drawRect(rx0,          y, nmNotW,  16, C.primary, C.border);
                drawRect(rx0 + nmNotW, y, nmMeanW, 16, C.primary, C.border);
                txt('Notation', rx0 + 3,          y + 4, { w: nmNotW  - 5, size: 7, color: C.white, bold: true });
                txt('Meaning',  rx0 + nmNotW + 3, y + 4, { w: nmMeanW - 5, size: 7, color: C.white, bold: true });
                y += 16;

                doc.fontSize(6.5).font('Helvetica');
                for (let ri = 0; ri < maxRows; ri++) {
                    const lEntry = leftCol[ri];
                    const rEntry = rightCol[ri];

                    // measure row height based on text wrapping
                    let rowH = 12;
                    if (lEntry) {
                        const h = doc.heightOfString(lEntry[1], { width: nmMeanW - 6 });
                        rowH = Math.max(rowH, h + 5);
                    }
                    if (rEntry) {
                        const h = doc.heightOfString(rEntry[1], { width: nmMeanW - 6 });
                        rowH = Math.max(rowH, h + 5);
                    }

                    checkBreak(rowH);

                    // Left pair
                    if (lEntry) {
                        const bg = ri % 2 === 0 ? C.white : C.bgLight;
                        drawRect(L,          y, nmNotW,  rowH, bg, C.border);
                        drawRect(L + nmNotW, y, nmMeanW, rowH, bg, C.border);
                        txt(lEntry[0], L + 3,          y + 3, { w: nmNotW  - 5, size: 6.5, color: C.primary, bold: true });
                        txt(lEntry[1], L + nmNotW + 3, y + 3, { w: nmMeanW - 6, size: 6.5, color: C.text, lineBreak: true });
                    }
                    // Right pair
                    if (rEntry) {
                        const bg = ri % 2 === 0 ? C.white : C.bgLight;
                        drawRect(rx0,          y, nmNotW,  rowH, bg, C.border);
                        drawRect(rx0 + nmNotW, y, nmMeanW, rowH, bg, C.border);
                        txt(rEntry[0], rx0 + 3,          y + 3, { w: nmNotW  - 5, size: 6.5, color: C.primary, bold: true });
                        txt(rEntry[1], rx0 + nmNotW + 3, y + 3, { w: nmMeanW - 6, size: 6.5, color: C.text, lineBreak: true });
                    }

                    y += rowH;
                }

                y += 10;
                txt('*************************   End of Credit Report   *************************', L, y, { w: W, size: 8.5, color: C.text, align: 'center' });
                y += 14;
                doc.moveTo(L, y).lineTo(L + W, y).strokeColor(C.border).lineWidth(1).stroke();
                y += 10;
                txt(`© Copyright 2026, Sahayaone Enterprise Loan Management System, All Rights Reserved.`, L, y, { w: W, size: 8, color: C.text, align: 'center' });
                const lastPageFooterY = y + 12;

                /* =========================================================
                 * PAGE FOOTERS (after full pagination is known)
                 * =========================================================*/
                const range = doc.bufferedPageRange();
                for (let i = 0; i < range.count; i++) {
                    doc.switchToPage(i);
                    if (i === range.count - 1) {
                        txt(`For Any Queries Pls. Call +91 8989 46 8686. Report No. ${data.header.reportNo} | Page ${i + 1} of ${range.count}`, L, lastPageFooterY, { w: W, size: 8, color: C.text, align: 'center' });
                        continue;
                    }

                    const fy = 822;
                    doc.strokeColor(C.border).lineWidth(0.5)
                       .moveTo(L, fy - 4).lineTo(L + W, fy - 4).stroke();

                    doc.fontSize(6.5).fillColor(C.muted).font('Helvetica')
                       .text(
                           `SAHAYAONE Enterprise Loan Management System  |  ${data.header.memberName}  |  All information is confidential and for authorised use only.`,
                           L, fy, { width: 360 }
                       );

                    doc.fontSize(6.5).fillColor(C.muted).font('Helvetica')
                       .text(`Report No. ${data.header.reportNo}`, L + 362, fy, { width: 100, align: 'right' });

                    doc.fontSize(6.5).fillColor(C.muted).font('Helvetica-Bold')
                       .text(`Page ${i + 1} of ${range.count}`, L + 464, fy, { width: 58, align: 'right' });
                }

                doc.end();
            } catch (err) {
                logger.error(`CIBIL PDF GENERATION ERROR: ${err.message}`, err);
                reject(err);
            }
        });
    }
}

export const creditSearchStylePdfService = new CreditSearchStylePdfService();
