import { Loan } from '../../../../models/loan.model.js';
import { User } from '../../../../models/user.model.js';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import '../../../../models/bank.model.js';
import '../../../../models/branch.model.js';
import '../../../../models/product.model.js';
import '../../../../models/brand.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';

export class CustomerLoanService {
  /**
   * Resolves user, profile, and phone candidates for customer ID
   */
  async getCandidateCustomerIds(customerId) {
    const user = await User.findById(customerId).lean();
    const profile = await CustomerProfile.findOne({
      $or: [
        { userId: customerId },
        ...(user?.profileId ? [{ _id: user.profileId }] : []),
        ...(user?.phoneNumber ? [{ phoneNumber: user.phoneNumber }] : [])
      ]
    }).lean();

    const candidateIds = [
      customerId,
      ...(user?._id ? [user._id] : []),
      ...(profile?._id ? [profile._id] : []),
      ...(profile?.userId ? [profile.userId] : [])
    ];

    return {
      candidateIds,
      phoneNumber: user?.phoneNumber || profile?.phoneNumber || null
    };
  }

  /**
   * Retrieves loan summary and lists for the customer across all banks
   */
  async getLoans(customerId) {
    const { candidateIds, phoneNumber } = await this.getCandidateCustomerIds(customerId);

    const query = {
      $or: [
        { customerId: { $in: candidateIds } },
        ...(phoneNumber ? [{ phoneNumber }] : [])
      ],
      isDeleted: false
    };

    const loans = await Loan.find(query)
      .populate({ path: 'assignedBankId', strictPopulate: false })
      .populate({ path: 'branchId', strictPopulate: false })
      .populate({
        path: 'variantId',
        populate: {
          path: 'productId',
          populate: { path: 'brandId' }
        },
        strictPopulate: false
      })
      .sort({ createdAt: -1 });

    // Calculate active loan summary metrics
    const activeStates = ['NEW', 'ACTIVE', 'DISBURSED', 'PENDING'];
    const activeLoans = loans.filter(l => activeStates.includes(l.status));

    const totalOutstanding = activeLoans.reduce((sum, l) => sum + (l.outstandingAmount || 0), 0);
    const totalLoanAmount = activeLoans.reduce((sum, l) => sum + (l.totalPayableAmount || l.loanAmount || 0), 0);
    const activeLoansCount = activeLoans.length;

    return {
      totalOutstanding,
      totalLoanAmount,
      activeLoansCount,
      loans
    };
  }

  /**
   * Retrieves single loan contract ledger details
   */
  async getLoanDetails(customerId, loanId) {
    const { candidateIds, phoneNumber } = await this.getCandidateCustomerIds(customerId);

    const loan = await Loan.findOne({
      _id: loanId,
      $or: [
        { customerId: { $in: candidateIds } },
        ...(phoneNumber ? [{ phoneNumber }] : [])
      ],
      isDeleted: false
    })
      .populate({ path: 'assignedBankId', strictPopulate: false })
      .populate({ path: 'branchId', strictPopulate: false })
      .populate({
        path: 'variantId',
        populate: {
          path: 'productId',
          populate: { path: 'brandId' }
        },
        strictPopulate: false
      });

    if (!loan) {
      throw ApiError.notFound('Loan contract record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    return loan;
  }

  /**
   * Simulates paying the next pending installment in the EMI schedule
   */
  async payNextEmi(customerId, loanId) {
    const { candidateIds, phoneNumber } = await this.getCandidateCustomerIds(customerId);

    const loan = await Loan.findOne({
      _id: loanId,
      $or: [
        { customerId: { $in: candidateIds } },
        ...(phoneNumber ? [{ phoneNumber }] : [])
      ],
      isDeleted: false
    });
    if (!loan) {
      throw ApiError.notFound('Loan contract record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (loan.status === 'COMPLETED') {
      throw ApiError.badRequest('This loan has already been fully repaid.', ErrorCode.VALIDATION_ERROR);
    }

    if (loan.status === 'REJECTED') {
      throw ApiError.badRequest('This loan application was rejected.', ErrorCode.VALIDATION_ERROR);
    }

    // Find the next unpaid installment (DUE first, then UPCOMING)
    let nextInstallment = loan.schedule.find(item => item.status === 'DUE');
    if (!nextInstallment) {
      nextInstallment = loan.schedule.find(item => item.status === 'UPCOMING');
    }

    if (!nextInstallment) {
      throw ApiError.badRequest('No pending EMI installments found in schedule.', ErrorCode.VALIDATION_ERROR);
    }

    // Process payment simulation
    nextInstallment.status = 'PAID';
    nextInstallment.paidAt = new Date();

    loan.paidEmisCount += 1;
    loan.outstandingAmount = Math.max(0, loan.outstandingAmount - nextInstallment.amount);

    // If active, change state to active if it was NEW
    if (loan.status === 'NEW') {
      loan.status = 'ACTIVE';
      loan.disbursedAt = loan.disbursedAt || new Date();
    }

    // Check if fully paid
    const pendingInstallments = loan.schedule.filter(item => item.status !== 'PAID');
    if (pendingInstallments.length === 0) {
      loan.status = 'COMPLETED';
      loan.outstandingAmount = 0;
      loan.nextEmiDueDate = null;
      loan.nocKey = `noc/customer_${customerId}_appl_${loan.applicationId}.pdf`;
    } else {
      // Set the next due date
      const nextDue = pendingInstallments[0];
      nextDue.status = 'DUE'; // Mark it as DUE now
      loan.nextEmiDueDate = nextDue.dueDate;
    }

    await loan.save();
    return loan;
  }

  /**
   * Generates a mock NOC certificate document
   */
  async generateMockNoc(customerId, loanId) {
    const loan = await Loan.findOne({ _id: loanId, customerId, isDeleted: false })
      .populate({
        path: 'variantId',
        populate: {
          path: 'productId',
          populate: { path: 'brandId' }
        }
      });

    if (!loan) {
      throw ApiError.notFound('Loan contract record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (loan.status !== 'COMPLETED') {
      throw ApiError.badRequest('No Objection Certificate (NOC) is only available for fully completed loans.', ErrorCode.VALIDATION_ERROR);
    }

    // Return mock PDF buffer
    const textContent = `
========================================================================
                      SAHAYAONE ENTERPRISE FINANCIERS
                      NO OBJECTION CERTIFICATE (NOC)
========================================================================
Date: ${new Date().toLocaleDateString()}
Loan Account Reference: ${loan.applicationId}
Customer Ref ID: ${customerId}

To Whomsoever It May Concern,

This is to certify that the loan account reference [${loan.applicationId}]
allotted to customer [Priya Sharma] for purchasing product variant 
[${loan.variantId?.productId?.name || 'Smart Phone'} - ${loan.variantId?.color || ''}] 
has been fully settled and closed on date [${loan.updatedAt.toLocaleDateString()}].

Sahayaone Enterprise Financiers has no further financial claims, liens, or dues
against the borrower or the purchased asset. This certificate stands as a formal
discharge of all financial liabilities under the active contract.

Authorized Signature,
Sahayaone Credit Operations Team
========================================================================
`;
    return Buffer.from(textContent, 'utf-8');
  }
}

export const customerLoanService = new CustomerLoanService();
