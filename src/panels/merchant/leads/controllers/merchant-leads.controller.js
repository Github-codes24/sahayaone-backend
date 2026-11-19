import { BaseController } from '../../../../common/base.controller.js';
import { merchantLeadsService } from '../services/merchant-leads.service.js';

export class MerchantLeadsController extends BaseController {
  /**
   * 1. GET ALL LEADS (Filtered by this merchant)
   */
  listLeads = this.catchAsync(async (req, res) => {
    const result = await merchantLeadsService.listLeads(req.user, req.query);
    return this.sendPaginated(res, result.items, result.pagination, result.message, { stats: result.stats });
  });

  /**
   * 2. SEND PHONE VERIFICATION OTP CODE (LOOKUP)
   */
  sendLookupOtp = this.catchAsync(async (req, res) => {
    const { phoneNumber } = req.body;
    const result = await merchantLeadsService.sendLookupOtp(phoneNumber);
    return this.sendResponse(res, 200, result, result.message);
  });

  /**
   * 3. SUBMIT PHONE VERIFICATION OTP (LOOKUP)
   */
  verifyLookupOtp = this.catchAsync(async (req, res) => {
    const { phoneNumber, otp } = req.body;
    const result = await merchantLeadsService.verifyLookupOtp(phoneNumber, otp);
    return this.sendResponse(res, 200, result, result.message);
  });

  /**
   * 4. INITIATE ONBOARDING (Aadhaar OTP Dispatch)
   */
  onboardCustomerRequest = this.catchAsync(async (req, res) => {
    const result = await merchantLeadsService.onboardCustomerRequest(req.body, req.user);
    return this.sendResponse(res, 200, result, result.message);
  });

  /**
   * 5. VERIFY AADHAAR OTP
   */
  verifyAadhaarOtp = this.catchAsync(async (req, res) => {
    const { phoneNumber, transactionId, otp } = req.body;
    const result = await merchantLeadsService.verifyAadhaarOtp(phoneNumber, transactionId, otp);
    return this.sendResponse(res, 200, result, result.message);
  });

  /**
   * 6. CONFIRM ONBOARDING
   */
  confirmOnboard = this.catchAsync(async (req, res) => {
    const result = await merchantLeadsService.confirmOnboard(req.body, req.user);
    return this.sendResponse(res, 200, result, result.message);
  });

  /**
   * 10. CREATE DRAFT LEAD APPLICATION
   */
  createLead = this.catchAsync(async (req, res) => {
    const result = await merchantLeadsService.createLead(req.body, req.user);
    return this.sendResponse(res, 200, result, result.message);
  });

  /**
   * 11. GET SINGLE LEAD DETAILS
   */
  getLeadDetails = this.catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await merchantLeadsService.getLeadDetails(req.user, id);
    return this.sendResponse(res, 200, result.data, result.message);
  });
}

export const merchantLeadsController = new MerchantLeadsController();
