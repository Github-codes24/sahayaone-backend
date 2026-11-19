import { Loan } from '../../../../models/loan.model.js';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import { loanPdfService } from './loan-pdf.service.js';
import { logger } from '../../../../utils/logger.util.js';

class LoanApprovalTimerService {
  constructor() {
    this.activeTimers = new Map();
  }

  /**
   * Starts a 5-minute auto-approval timer for a loan application
   * @param {string} loanId MongoDB ObjectId or Loan Application ID
   */
  startAutoApprovalTimer(loanId) {
    const loanIdStr = String(loanId);
    
    // Clear any existing timer for this loan
    if (this.activeTimers.has(loanIdStr)) {
      clearTimeout(this.activeTimers.get(loanIdStr));
      this.activeTimers.delete(loanIdStr);
    }

    logger.info(`[Auto-Approval Engine] Starting 5-minute timer for Loan [${loanIdStr}]...`);

    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    const timer = setTimeout(async () => {
      try {
        await this.executeAutoApproval(loanIdStr);
      } catch (err) {
        logger.error(`[Auto-Approval Engine Error] Failed for Loan [${loanIdStr}]:`, err.message);
      } finally {
        this.activeTimers.delete(loanIdStr);
      }
    }, FIVE_MINUTES_MS);

    this.activeTimers.set(loanIdStr, timer);
  }

  /**
   * Cancels the auto-approval timer if manual action (Approve/Reject) is taken by Admin
   */
  cancelTimer(loanId) {
    const loanIdStr = String(loanId);
    if (this.activeTimers.has(loanIdStr)) {
      clearTimeout(this.activeTimers.get(loanIdStr));
      this.activeTimers.delete(loanIdStr);
      logger.info(`[Auto-Approval Engine] Timer cancelled for Loan [${loanIdStr}] due to manual action.`);
    }
  }

  /**
   * Executes Auto-Approval when 5 minutes expire with no manual action
   */
  async executeAutoApproval(loanIdStr) {
    logger.info(`[Auto-Approval Engine] 5 minutes expired! Auto-Approving Loan [${loanIdStr}]...`);

    const loan = await Loan.findOne({
      $or: [{ _id: loanIdStr }, { applicationId: loanIdStr }],
    });

    if (!loan) {
      logger.warn(`[Auto-Approval Engine] Loan [${loanIdStr}] not found in database.`);
      return;
    }

    // Only auto-approve if still pending approval
    if (loan.status !== 'PENDING' && loan.status !== 'PENDING_APPROVAL' && loan.approvalTimer?.approvalStatus !== 'PENDING_APPROVAL') {
      logger.info(`[Auto-Approval Engine] Loan [${loan.applicationId}] is already in status [${loan.status}]. Skipping auto-approval.`);
      return;
    }

    // 1. Update loan status to APPROVED
    loan.status = 'APPROVED';
    loan.approvalTimer = {
      approvalStatus: 'AUTO_APPROVED',
      timerExpiresAt: new Date(),
      approvedAt: new Date(),
      autoApproved: true,
    };
    loan.draftMetadata.lastSavedStep = 'APPROVED';

    // 2. Fetch customer details for PDF generation
    const profile = await CustomerProfile.findOne({ customerId: loan.customerId });
    const customerData = profile
      ? {
          fullName: profile.fullName,
          phoneNumber: profile.phoneNumber,
          aadhaarNumber: profile.aadhaarNumber,
          panNumber: profile.panNumber,
          address: profile.currentAddress || profile.address,
          dob: profile.dob,
          isFirstTimeMember: profile.isFirstTimeMember,
        }
      : {};

    // 3. Generate 3 PDF Documents automatically
    const pdfs = await loanPdfService.generateAllPostApprovalPdfs(loan, customerData);
    loan.pdfDocuments = pdfs;

    await loan.save();

    logger.info(`[Auto-Approval Engine] Loan [${loan.applicationId}] AUTO-APPROVED successfully! 3 PDFs generated.`);
  }
}

export const loanApprovalTimerService = new LoanApprovalTimerService();
