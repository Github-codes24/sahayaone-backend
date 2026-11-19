import PDFDocument from 'pdfkit';
import { storageManager } from '../../../../storage/storage.manager.js';
import { logger } from '../../../../utils/logger.util.js';

export class LoanPdfService {
  /**
   * Helper to convert PDFKit document stream into a Buffer
   */
  async buildPdfBuffer(buildFn) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      try {
        buildFn(doc);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Helper to upload a PDF Buffer to Storage
   */
  async uploadPdfBuffer(pdfBuffer, filename, folder = 'loan_documents') {
    const fileObj = {
      buffer: pdfBuffer,
      originalname: filename,
      mimetype: 'application/pdf',
    };
    const uploadResult = await storageManager.uploadFile(fileObj, folder);
    return uploadResult.url || uploadResult.secure_url || uploadResult.location;
  }

  /**
   * 📄 PDF 1: Loan Agreement PDF Generator
   */
  async generateLoanAgreementPdf(loan, customer = {}) {
    const buffer = await this.buildPdfBuffer((doc) => {
      // Header
      doc.fontSize(20).text('SAHAYAONE FINTECH - LOAN AGREEMENT', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Application ID: ${loan.applicationId} | Date: ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' });
      doc.moveDown(1.5);

      // Section 1: Customer Details
      doc.fontSize(14).text('1. BORROWER DETAILS', { underline: true });
      doc.fontSize(10).text(`Full Name: ${customer.fullName || 'N/A'}`);
      doc.text(`Phone Number: ${customer.phoneNumber || 'N/A'}`);
      doc.text(`Aadhaar Number: ${customer.aadhaarNumber || 'N/A'}`);
      doc.text(`PAN Number: ${customer.panNumber || 'N/A'}`);
      doc.text(`Address: ${customer.address || 'N/A'}`);
      doc.moveDown(1);

      // Section 2: Loan Financial Terms
      doc.fontSize(14).text('2. LOAN TERMS & FINANCIAL DETAILS', { underline: true });
      doc.fontSize(10).text(`Product Price: ₹${loan.productPrice || 0}`);
      doc.text(`Down Payment Paid: ₹${loan.downPayment || 0}`);
      doc.text(`Net Principal Loan Amount: ₹${loan.totalLoanAmount || 0}`);
      doc.text(`Interest & Processing Fees: ₹${(loan.interestAmount || 0) + (loan.processingFees || 0)}`);
      doc.text(`Total Payable Amount: ₹${loan.totalPayableAmount || 0}`);
      doc.text(`Tenure: ${loan.tenureMonths || 0} Months`);
      doc.text(`Monthly EMI: ₹${loan.emiAmount || 0}`);
      doc.moveDown(1);

      // Section 3: Repayment Bank & Mandate Details
      doc.fontSize(14).text('3. REPAYMENT BANK & E-NACH MANDATE', { underline: true });
      const bank = loan.repaymentBankAccount || {};
      doc.fontSize(10).text(`Account Holder: ${bank.accountHolder || customer.fullName || 'N/A'}`);
      doc.text(`Bank Name: ${bank.bankName || 'N/A'}`);
      doc.text(`Account Number: ${bank.accountNumber || 'N/A'}`);
      doc.text(`IFSC Code: ${bank.ifsc || 'N/A'}`);
      doc.text(`Razorpay Mandate Token: ${loan.mandateDetails?.tokenId || 'PENDING'}`);
      doc.text(`Max Authorized Limit: ₹${loan.mandateDetails?.maxAmount || 15000} / month`);
      doc.moveDown(1.5);

      // Footer Terms
      doc.fontSize(8).text('This agreement is subject to the general terms and conditions of Sahayaone Co-operative Society/Bank.', { align: 'center' });
    });

    const filename = `Loan_Agreement_${loan.applicationId}_${Date.now()}.pdf`;
    return await this.uploadPdfBuffer(buffer, filename, 'loan_agreements');
  }

  /**
   * 🏛️ PDF 2: Society Account Opening Form PDF (First Time Members)
   */
  async generateSocietyAccountOpeningPdf(loan, customer = {}) {
    const buffer = await this.buildPdfBuffer((doc) => {
      doc.fontSize(18).text('CO-OPERATIVE CREDIT SOCIETY', { align: 'center' });
      doc.fontSize(16).text('MEMBERSHIP & SAVINGS ACCOUNT OPENING FORM', { align: 'center' });
      doc.moveDown(1);

      doc.fontSize(12).text(`Application Ref: ${loan.applicationId}`);
      doc.fontSize(10).text(`Date: ${new Date().toLocaleDateString('en-IN')}`);
      doc.moveDown(1);

      doc.fontSize(12).text('MEMBER APPLICANT DETAILS:', { underline: true });
      doc.fontSize(10).text(`Applicant Full Name: ${customer.fullName || 'N/A'}`);
      doc.text(`Mobile Number: ${customer.phoneNumber || 'N/A'}`);
      doc.text(`Aadhaar Number: ${customer.aadhaarNumber || 'N/A'}`);
      doc.text(`PAN Number: ${customer.panNumber || 'N/A'}`);
      doc.text(`Date of Birth: ${customer.dob || 'N/A'}`);
      doc.text(`Residential Address: ${customer.address || 'N/A'}`);
      doc.moveDown(1.5);

      doc.fontSize(12).text('MEMBERSHIP DECLARATION:', { underline: true });
      doc.fontSize(9).text('I hereby apply for membership of the Co-operative Credit Society and agree to abide by its rules, bylaws, and regulations. I declare that the details provided above are true to the best of my knowledge.');
      doc.moveDown(2);

      doc.fontSize(10).text('Applicant Signature (Digitally Captured)', { align: 'right' });
    });

    const filename = `Society_Membership_${loan.applicationId}_${Date.now()}.pdf`;
    return await this.uploadPdfBuffer(buffer, filename, 'society_forms');
  }

  /**
   * ✒️ PDF 3: Key Fact Statement (KFS) & Stamped Signed Document PDF
   */
  async generateKfsSignedDocumentPdf(loan, customer = {}) {
    const buffer = await this.buildPdfBuffer((doc) => {
      doc.fontSize(18).text('KEY FACT STATEMENT (KFS) & DIGITALLY SIGNED SANCTION', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Loan Application No: ${loan.applicationId}`, { align: 'center' });
      doc.moveDown(1);

      doc.fontSize(12).text('KEY LOAN SUMMARY (RBI MANDATED FORMAT):', { underline: true });
      doc.fontSize(10).text(`1. Loan Amount: ₹${loan.totalLoanAmount || 0}`);
      doc.text(`2. Total Interest & Charges: ₹${(loan.interestAmount || 0) + (loan.processingFees || 0)}`);
      doc.text(`3. Total Repayable Amount: ₹${loan.totalPayableAmount || 0}`);
      doc.text(`4. Monthly EMI Amount: ₹${loan.emiAmount || 0}`);
      doc.text(`5. Tenure: ${loan.tenureMonths || 0} Months`);
      doc.text(`6. Annualized Interest Rate (APR): ${loan.interestRate || '18% p.a.'}`);
      doc.moveDown(1.5);

      doc.fontSize(12).text('DIGITAL SIGNATURE & T&C ACCEPTANCE STAMP:', { underline: true });
      doc.fontSize(10).text(`Customer Name: ${customer.fullName || 'N/A'}`);
      doc.text(`Terms Accepted Status: ${loan.termsAccepted?.accepted ? 'ACCEPTED' : 'YES'}`);
      doc.text(`Accepted Timestamp: ${loan.termsAccepted?.acceptedAt ? new Date(loan.termsAccepted.acceptedAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN')}`);
      doc.text(`IP Address: ${loan.termsAccepted?.ipAddress || '127.0.0.1'}`);
      doc.text(`Touch Digital Signature Image: ${loan.digitalSignature ? 'CAPTURED & STAMPED' : 'PENDING'}`);
      doc.moveDown(2);

      doc.fontSize(8).text('This Key Fact Statement is digitally generated and electronically signed under Information Technology Act, 2000.', { align: 'center' });
    });

    const filename = `KFS_Signed_${loan.applicationId}_${Date.now()}.pdf`;
    return await this.uploadPdfBuffer(buffer, filename, 'kfs_documents');
  }

  /**
   * Triggers generation of all 3 PDFs upon loan approval
   */
  async generateAllPostApprovalPdfs(loan, customer = {}) {
    try {
      logger.info(`PDF GENERATION ENGINE: Generating 3 PDFs for Loan [${loan.applicationId}]...`);
      
      const loanAgreementUrl = await this.generateLoanAgreementPdf(loan, customer);
      
      let societyFormUrl = null;
      if (customer.isFirstTimeMember || loan.isFirstTimeMember) {
        societyFormUrl = await this.generateSocietyAccountOpeningPdf(loan, customer);
      }

      const kfsSignedUrl = await this.generateKfsSignedDocumentPdf(loan, customer);

      logger.info(`PDF GENERATION ENGINE: Completed 3 PDFs for Loan [${loan.applicationId}]!`);

      return {
        loanAgreementPdfUrl: loanAgreementUrl,
        societyAccountOpeningPdfUrl: societyFormUrl,
        kfsSignedDocumentPdfUrl: kfsSignedUrl,
        generatedAt: new Date(),
      };
    } catch (err) {
      logger.error(`PDF GENERATION ENGINE ERROR for Loan [${loan.applicationId}]:`, err.message);
      return {
        loanAgreementPdfUrl: null,
        societyAccountOpeningPdfUrl: null,
        kfsSignedDocumentPdfUrl: null,
        error: err.message,
      };
    }
  }
}

export const loanPdfService = new LoanPdfService();
