import { BaseController } from '../../../../common/base.controller.js';
import { loanApplicationService } from '../services/loan-application.service.js';

export class CustomerLoanApplicationController extends BaseController {
  constructor() {
    super();
    this.createApplication = this.catchAsync(this.createApplication.bind(this));
    this.submitPersonalDetails = this.catchAsync(this.submitPersonalDetails.bind(this));
    this.verifyAadhaarOtp = this.catchAsync(this.verifyAadhaarOtp.bind(this));
    this.triggerAddressOtp = this.catchAsync(this.triggerAddressOtp.bind(this));
    this.verifyAddressOtp = this.catchAsync(this.verifyAddressOtp.bind(this));
    this.submitApplication = this.catchAsync(this.submitApplication.bind(this));
  }

  /**
   * Starts a new draft loan application
   */
  async createApplication(req, res, next) {
    const { variantIds } = req.body;
    const customerId = req.user.id;

    const result = await loanApplicationService.createApplication(customerId, variantIds);
    return this.sendResponse(res, 201, result, 'Draft loan application started successfully.');
  }

  /**
   * Saves personal details and triggers Aadhaar verification
   */
  async submitPersonalDetails(req, res, next) {
    const { id } = req.params;
    const customerId = req.user.id;
    const payload = req.body;

    const result = await loanApplicationService.submitPersonalDetails(id, customerId, payload);
    return this.sendResponse(res, 200, result, result.message);
  }

  /**
   * Verifies Aadhaar verification OTP code
   */
  async verifyAadhaarOtp(req, res, next) {
    const { id } = req.params;
    const customerId = req.user.id;
    const { transactionId, otp } = req.body;

    const result = await loanApplicationService.verifyAadhaarOtp(id, customerId, transactionId, otp);
    return this.sendResponse(res, 200, result, 'Aadhaar identity verified successfully.');
  }

  /**
   * Re-triggers Aadhaar OTP for residential address updates
   */
  async triggerAddressOtp(req, res, next) {
    const { id } = req.params;
    const customerId = req.user.id;

    const result = await loanApplicationService.triggerAddressOtp(id, customerId);
    return this.sendResponse(res, 200, result, 'Verification code dispatched to your registered Aadhaar mobile number.');
  }

  /**
   * Verifies address verification OTP code and saves updated address
   */
  async verifyAddressOtp(req, res, next) {
    const { id } = req.params;
    const customerId = req.user.id;
    const { transactionId, otp } = req.body;

    const result = await loanApplicationService.verifyAddressOtp(id, customerId, transactionId, otp);
    return this.sendResponse(res, 200, result, 'Address updated successfully.');
  }

  /**
   * Submits and locks the loan application
   */
  async submitApplication(req, res, next) {
    const { id } = req.params;
    const customerId = req.user.id;

    const result = await loanApplicationService.submitApplication(id, customerId);
    return this.sendResponse(res, 200, result, 'Your application has been received successfully.');
  }
}

export const customerLoanApplicationController = new CustomerLoanApplicationController();
