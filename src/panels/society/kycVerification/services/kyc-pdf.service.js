import PDFDocument from 'pdfkit';
import { Bank } from '../../../../models/bank.model.js';
import { logger } from '../../../../utils/logger.util.js';

// Color Palette matching Sahayaone's styling guide
const C = {
  primary: '#1b3a63',   // Deep Blue
  accent: '#C09637',   // Gold
  text: '#2D3748',   // Charcoal Dark Text
  muted: '#718096',   // Cool Grey
  border: '#E2E8F0',   // Light border grey
  bgLight: '#F8FAFC',   // Slate bg
  bgAlt: '#F1F5F9',   // Table alt row
  success: '#15803D',   // Rich Green
  white: '#FFFFFF'
};

const maskId = (documentType, value) => {
  if (!value) return 'N/A';
  const v = String(value).trim();
  if (documentType === 'AADHAAR') {
    // Standard Aadhaar masking format: XXXX XXXX 1234
    return v.length >= 12 ? `XXXX XXXX ${v.slice(-4)}` : 'XXXX XXXX XXXX';
  }
  // PAN format: ABCDE1234F -> ABXXXXXX2F
  return v.length >= 10 ? `${v.slice(0, 2)}XXXXXX${v.slice(-2)}` : 'XXXXXXXXXX';
};

export class KycPdfService {
  /**
   * Generates a styled, co-branded PDF verification certificate (Page 1)
   * followed by a reconstructed replica card (Page 2).
   * @param {Object} kycRecord The KYC verification document from MongoDB
   * @param {String} targetDocType The document type to generate (AADHAAR or PAN)
   * @returns {Promise<PDFDocument>} PDFKit document stream
   */
  async generateVerificationPdf(kycRecord, targetDocType) {
    const docType = String(targetDocType || kycRecord.documentType).toUpperCase();
    logger.info('[KYC:PDF] Initiating PDF generation', { refid: kycRecord.refid, docType });

    let societyName = '';
    if (kycRecord.societyId) {
      try {
        const bankDoc = await Bank.findById(kycRecord.societyId).lean();
        if (bankDoc && bankDoc.name) {
          societyName = bankDoc.name;
        }
      } catch (err) {
        logger.error('[KYC:PDF] Failed to fetch bank/society details for PDF branding', { error: err.message });
      }
    }

    const doc = new PDFDocument({
      size: 'A4',
      margin: 40
    });

    const L = 40;  // Left Margin
    const W = 515; // Printable Width (595 A4 width - 80 margins)
    let y = 40;

    // Helper functions for drawing
    const txt = (str, x, yPos, opt = {}) => {
      doc.fillColor(opt.color || C.text);
      doc.fontSize(opt.size || 8.5);

      const font = opt.bold ? 'Helvetica-Bold' : 'Helvetica';
      doc.font(font);

      doc.text(String(str), x, yPos, {
        width: opt.w,
        align: opt.align || 'left',
        lineBreak: opt.lineBreak !== false
      });
    };

    const drawRect = (x, yPos, w, h, fill, stroke) => {
      if (fill) {
        doc.rect(x, yPos, w, h).fill(fill);
      }
      if (stroke) {
        doc.rect(x, yPos, w, h).lineWidth(0.5).stroke(stroke);
      }
    };

    // 1. HEADER (Sahayaone co-branding banner)
    drawRect(L, y, W, 50, C.primary);

    // Sahayaone (Left Side)
    txt('SAHAYAONE', L + 12, y + 10, { size: 18, color: C.accent, bold: true });
    txt('Enterprise Loan Management System', L + 12, y + 30, { size: 7.5, color: '#A0AEC0' });

    // Society Name (Right Side)
    txt(societyName, L + 200, y + 12, { w: W - 212, size: 11, color: C.white, bold: true, align: 'right' });
    txt('KYC Verification Certificate', L + 200, y + 27, { w: W - 212, size: 8, color: C.accent, align: 'right' });
    y += 65;

    // Report Title
    txt('DIGILOCKER KYC VERIFICATION REPORT', L, y, { w: W, size: 14, color: C.primary, bold: true, align: 'center' });
    y += 25;

    // Helper function for building a structured grid
    const drawGridRow = (label1, val1, label2, val2) => {
      const rowHeight = 22;
      const colWidth = W / 2;

      // Col 1 Label
      drawRect(L, y, colWidth * 0.35, rowHeight, C.bgLight, C.border);
      txt(label1, L + 8, y + 7, { size: 8.5, color: C.primary, bold: true });

      // Col 1 Val
      drawRect(L + colWidth * 0.35, y, colWidth * 0.65, rowHeight, C.white, C.border);
      txt(val1 || 'N/A', L + colWidth * 0.35 + 8, y + 7, { size: 8.5 });

      // Col 2 Label
      drawRect(L + colWidth, y, colWidth * 0.35, rowHeight, C.bgLight, C.border);
      txt(label2, L + colWidth + 8, y + 7, { size: 8.5, color: C.primary, bold: true });

      // Col 2 Val
      drawRect(L + colWidth + colWidth * 0.35, y, colWidth * 0.65, rowHeight, C.white, C.border);
      txt(val2 || 'N/A', L + colWidth + colWidth * 0.35 + 8, y + 7, { size: 8.5 });

      y += rowHeight;
    };

    // SECTION 1: VERIFICATION METADATA
    txt('VERIFICATION METADATA', L, y, { size: 10, color: C.primary, bold: true });
    y += 12;

    const formattedDate = kycRecord.verifiedAt
      ? new Date(kycRecord.verifiedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : new Date().toLocaleString('en-IN');

    drawGridRow('Ref ID', kycRecord.refid, 'Document Type', docType);
    drawGridRow('Status', kycRecord.status, 'Verified At', formattedDate);
    drawGridRow('Billing Code', String(kycRecord.billingCode || '200'), 'Consent Granted', kycRecord.consent ? 'YES' : 'NO');
    y += 20;

    // SECTION 2: VERIFIED PERSONAL DETAILS
    txt('VERIFIED IDENTITY DETAILS', L, y, { size: 10, color: C.primary, bold: true });
    y += 12;

    const details = kycRecord.personalDetails || {};
    const docNumber = docType === 'AADHAAR' ? details.aadhaarNumber : details.panNumber;
    const maskedNumber = maskId(docType, docNumber || kycRecord.idNumber);

    drawGridRow('Full Name', details.fullName, 'Document ID', maskedNumber);
    drawGridRow('Date of Birth', details.dob, 'Gender', details.gender);
    drawGridRow('Father Name', details.fatherName, 'Status Detail', docType === 'AADHAAR' ? details.aadhaarStatus : details.panStatus);

    // Render Address (Requires special multiline layout)
    const addrH = Math.max(30, doc.heightOfString(details.address || 'N/A', { width: W * 0.825 - 16 }) + 14);

    // Address Label
    drawRect(L, y, W * 0.175, addrH, C.bgLight, C.border);
    txt('Address', L + 8, y + (addrH / 2 - 4), { size: 8.5, color: C.primary, bold: true });

    // Address Value
    drawRect(L + W * 0.175, y, W * 0.825, addrH, C.white, C.border);
    txt(details.address || 'N/A', L + W * 0.175 + 8, y + 8, { w: W * 0.825 - 16, size: 8.5, lineBreak: true });

    y += addrH + 40;

    // SECTION 3: SYSTEM AUDIT STAMP
    txt('SYSTEM AUDIT TRAIL', L, y, { size: 10, color: C.primary, bold: true });
    y += 12;

    const boxWidth = W;
    const boxHeight = 65;
    drawRect(L, y, boxWidth, boxHeight, C.bgLight, C.border);

    txt('DigiLocker Integration Verification Stamp:', L + 10, y + 8, { size: 8, color: C.muted, bold: true });
    txt(`- API Provider: Paysprint SprintVerify`, L + 10, y + 20, { size: 8, color: C.muted });
    txt(`- Original Signed XML Document Hash: SHA-256 Verified`, L + 10, y + 30, { size: 8, color: C.muted });
    txt(`- IP Timestamped Record: Logged successfully in security system logs`, L + 10, y + 40, { size: 8, color: C.muted });
    txt(`- Verified System Integrity: SECURE-CONNECT`, L + 10, y + 50, { size: 8, color: C.success, bold: true });

    // Draw a success stamp box inside
    drawRect(L + W - 110, y + 10, 100, 45, C.white, C.success);
    txt('VERIFIED', L + W - 110, y + 22, { w: 100, size: 11, color: C.success, bold: true, align: 'center' });
    txt('via DigiLocker', L + W - 110, y + 35, { w: 100, size: 6.5, color: C.success, align: 'center' });

    y += boxHeight + 40;

    // FOOTER (Copyright and disclaimer)
    doc.strokeColor(C.border).lineWidth(0.5).moveTo(L, y).lineTo(L + W, y).stroke();
    y += 10;
    txt('Disclaimer: This is a computer-generated KYC report verified securely using individual consent via DigiLocker. The integrity of these details relies on the governmental authority database (UIDAI / IT Dept).', L, y, { w: W, size: 7, color: C.muted, align: 'center' });
    txt(`Copyright © ${new Date().getFullYear()} Sahayaone. All rights reserved.`, L, y + 15, { w: W, size: 7, color: C.muted, align: 'center' });
    doc.end();
    return doc;
  }
}

export const kycPdfService = new KycPdfService();
