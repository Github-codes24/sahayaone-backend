import { BaseController } from '../../../../common/base.controller.js';
import { leadsService } from '../services/leads.service.js';

export class LeadsController extends BaseController {
  constructor() {
    super();
    this.sendLookupOtp = this.catchAsync(this.sendLookupOtp.bind(this));
    this.verifyLookupOtp = this.catchAsync(this.verifyLookupOtp.bind(this));
    this.onboardCustomerRequest = this.catchAsync(this.onboardCustomerRequest.bind(this));
    this.verifyAadhaarOtp = this.catchAsync(this.verifyAadhaarOtp.bind(this));
    this.confirmOnboard = this.catchAsync(this.confirmOnboard.bind(this));
    this.createLead = this.catchAsync(this.createLead.bind(this));
    this.initiateDigiLockerKyc = this.catchAsync(this.initiateDigiLockerKyc.bind(this));
    this.verifyDigiLockerKyc = this.catchAsync(this.verifyDigiLockerKyc.bind(this));
    this.checkCibilScore = this.catchAsync(this.checkCibilScore.bind(this));
    this.digiLockerKycAndCibilCheck = this.catchAsync(this.digiLockerKycAndCibilCheck.bind(this));
    this.submitCustomerOnboarding = this.catchAsync(this.submitCustomerOnboarding.bind(this));
    this.getEligibleMerchants = this.catchAsync(this.getEligibleMerchants.bind(this));
    this.submitProductDetails = this.catchAsync(this.submitProductDetails.bind(this));
    this.getEmiSlabs = this.catchAsync(this.getEmiSlabs.bind(this));
    this.calculateLoanDetails = this.catchAsync(this.calculateLoanDetails.bind(this));
    this.listLeads = this.catchAsync(this.listLeads.bind(this));
    this.getLeadDetails = this.catchAsync(this.getLeadDetails.bind(this));
    this.initiateMandate = this.catchAsync(this.initiateMandate.bind(this));
    this.verifyMandate = this.catchAsync(this.verifyMandate.bind(this));
    this.submitLoanApplicationWithMandate = this.catchAsync(this.submitLoanApplicationWithMandate.bind(this));
    this.resumeDraftLead = this.catchAsync(this.resumeDraftLead.bind(this));
    this.getLeadStatus = this.catchAsync(this.getLeadStatus.bind(this));
    this.initiateAadhaarEsign = this.catchAsync(this.initiateAadhaarEsign.bind(this));
    this.listBranchSettlementLeads = this.catchAsync(this.listBranchSettlementLeads.bind(this));
    this.listMerchantSystemLeads = this.catchAsync(this.listMerchantSystemLeads.bind(this));
    this.listCustomerSystemLeads = this.catchAsync(this.listCustomerSystemLeads.bind(this));
    this.approveCustomerLead = this.catchAsync(this.approveCustomerLead.bind(this));
    this.rejectCustomerLead = this.catchAsync(this.rejectCustomerLead.bind(this));
    this.settleMerchantLoan = this.catchAsync(this.settleMerchantLoan.bind(this));
    this.getBanners = this.catchAsync(this.getBanners.bind(this));
  }

  async getBanners(req, res, next) {
    const result = await leadsService.getBanners(req.query);
    return this.sendResponse(res, 200, result, result.message);
  }

  async getEligibleMerchants(req, res, next) {
    const result = await leadsService.getEligibleMerchants(req.user);
    return this.sendResponse(res, 200, result, result.message);
  }

  async submitProductDetails(req, res, next) {
    const result = await leadsService.submitProductDetails(req.user, req.body);
    return this.sendResponse(res, 200, result, result.message);
  }

  async getEmiSlabs(req, res, next) {
    const payload = { ...req.query, ...req.body };
    const result = await leadsService.getEmiSlabs(req.user, payload);
    return this.sendResponse(res, 200, result, result.message);
  }

  async calculateLoanDetails(req, res, next) {
    const payload = { ...req.query, ...req.body };
    const result = await leadsService.calculateLoanDetails(req.user, payload);
    return this.sendResponse(res, 200, result, result.message);
  }

  async sendLookupOtp(req, res, next) {
    const { phoneNumber, type, productType } = req.body;
    const resolvedType = type || productType || 'LOAN';
    const result = await leadsService.sendLookupOtp(phoneNumber, resolvedType);
    return this.sendResponse(res, 200, result, result.message);
  }

  async verifyLookupOtp(req, res, next) {
    const { phoneNumber, otp, type, productType } = req.body;
    const resolvedType = type || productType || 'LOAN';
    const result = await leadsService.verifyLookupOtp(phoneNumber, otp, resolvedType, req.user, req.body);
    return this.sendResponse(res, 200, result, result.message);
  }

  async initiateDigiLockerKyc(req, res, next) {
    const result = await leadsService.initiateDigiLockerKyc(req.body, req.user.id);
    return this.sendResponse(res, 200, result, result.message);
  }

  async verifyDigiLockerKyc(req, res, next) {
    const { refid } = req.body;
    const result = await leadsService.verifyDigiLockerKyc(refid, req.user.id);
    return this.sendResponse(res, 200, result, result.message);
  }

  async checkCibilScore(req, res, next) {
    const result = await leadsService.checkCibilScore(req.body, req.user.id);
    return this.sendResponse(res, 200, result, result.message);
  }

  async digiLockerKycAndCibilCheck(req, res, next) {
    const result = await leadsService.digiLockerKycAndCibilCheck(req.user, req.body);
    return this.sendResponse(res, 200, result, result.message);
  }

  async submitCustomerOnboarding(req, res, next) {
    const result = await leadsService.submitCustomerOnboarding(req.user, req.body);
    return this.sendResponse(res, 201, result, result.message);
  }

  async onboardCustomerRequest(req, res, next) {
    const result = await leadsService.onboardCustomerRequest(req.body, req.user.id);
    return this.sendResponse(res, 200, result, result.message);
  }

  async verifyAadhaarOtp(req, res, next) {
    const { phoneNumber, transactionId, otp } = req.body;
    const result = await leadsService.verifyAadhaarOtp(phoneNumber, transactionId, otp);
    return this.sendResponse(res, 200, result, result.message);
  }

  async confirmOnboard(req, res, next) {
    const result = await leadsService.confirmOnboard(req.body, req.user.id);
    return this.sendResponse(res, 201, result, result.message);
  }

  async createLead(req, res, next) {
    const { customerId, variantId } = req.body;
    const result = await leadsService.createLead(customerId, variantId, req.user.id);
    return this.sendResponse(res, 201, result, result.message);
  }

  async listLeads(req, res, next) {
    const {
      status,
      approvalStatus,
      customerType,
      savingsAccountOption,
      currentStep,
      search,
      merchantId,
      branchId,
      startDate,
      endDate,
      fromDate,
      toDate,
      date,
      page,
      limit,
      sortBy,
      sortOrder,
      type,
      productType
    } = req.query;

    const result = await leadsService.listLeads(req.user, {
      status,
      approvalStatus,
      customerType,
      savingsAccountOption,
      currentStep,
      search,
      merchantId,
      branchId,
      startDate,
      endDate,
      fromDate,
      toDate,
      date,
      page,
      limit,
      sortBy,
      sortOrder,
      type: type || productType
    });

    return this.sendPaginated(
      res,
      result.items,
      result.pagination,
      `${result.productType || 'Customer'} leads successfully retrieved.`,
      result.stats ? { stats: result.stats } : {}
    );
  }

  async getLeadDetails(req, res, next) {
    const { id } = req.params;
    const result = await leadsService.getLeadDetails(id, req.user, req.query);
    return this.sendResponse(res, 200, result, 'Customer lead details successfully retrieved.');
  }

  async initiateMandate(req, res, next) {
    const rawHost = req.get('host') || 'localhost:5000';
    const isLocal = rawHost.includes('localhost') || rawHost.includes('127.0.0.1');
    const protocol = isLocal ? req.protocol : (req.get('x-forwarded-proto') || 'https');
    const hostUrl = `${protocol}://${rawHost}`;
    const result = await leadsService.initiateMandate(req.user, { ...req.body, hostUrl });
    return this.sendResponse(res, 200, result, result.message);
  }

  async verifyMandate(req, res, next) {
    const result = await leadsService.verifyMandate(req.user, req.body);
    return this.sendResponse(res, 200, result, result.message);
  }

  async submitLoanApplicationWithMandate(req, res, next) {
    const result = await leadsService.submitLoanApplicationWithMandate(req.user, req.body);
    return this.sendResponse(res, 200, result, result.message);
  }

  async resumeDraftLead(req, res, next) {
    const { identifier } = req.params;
    const result = await leadsService.resumeDraftLead(req.user, identifier);
    return this.sendResponse(res, 200, result, result.message);
  }

  async initiateAadhaarEsign(req, res, next) {
    const result = await leadsService.initiateAadhaarEsign(req.user, req.body);
    return this.sendResponse(res, 200, result, result.message);
  }

  async verifyAadhaarEsign(req, res, next) {
    const result = await leadsService.verifyAadhaarEsign(req.user, req.body);
    return this.sendResponse(res, 200, result, result.message);
  }

  async getLeadStatus(req, res, next) {
    const { id } = req.params;
    const result = await leadsService.getLeadStatus(id);
    return this.sendResponse(res, 200, result, 'Loan application status retrieved successfully.');
  }

  async listBranchSettlementLeads(req, res, next) {
    const { settlementStatus, status, approvalStatus, search, merchantId, branchId, startDate, endDate, page, limit, sortBy, sortOrder } = req.query;
    const result = await leadsService.listBranchSettlementLeads(req.user, {
      settlementStatus,
      status,
      approvalStatus,
      search,
      merchantId,
      branchId,
      startDate,
      endDate,
      page,
      limit,
      sortBy,
      sortOrder
    });
    return this.sendPaginated(res, result.items, result.pagination, 'Branch merchant settlement leads retrieved successfully.', { stats: result.stats });
  }

  async listMerchantSystemLeads(req, res, next) {
    return this.listBranchSettlementLeads(req, res, next);
  }

  async listCustomerSystemLeads(req, res, next) {
    const { status, search, branchId, startDate, endDate, page, limit, sortBy, sortOrder } = req.query;
    const result = await leadsService.listCustomerSystemLeads(req.user, {
      status,
      search,
      branchId,
      startDate,
      endDate,
      page,
      limit,
      sortBy,
      sortOrder
    });
    return this.sendPaginated(res, result.items, result.pagination, 'Customer system loan leads retrieved successfully.', { stats: result.stats });
  }

  async approveCustomerLead(req, res, next) {
    const { id } = req.params;
    const result = await leadsService.approveCustomerLead(req.user, id, req.body);
    return this.sendResponse(res, 200, result, result.message);
  }

  async rejectCustomerLead(req, res, next) {
    const { id } = req.params;
    const result = await leadsService.rejectCustomerLead(req.user, id, req.body);
    return this.sendResponse(res, 200, result, result.message);
  }

  async settleMerchantLoan(req, res, next) {
    const { id } = req.params;
    const result = await leadsService.settleMerchantLoan(req.user, id, req.body);
    return this.sendResponse(res, 200, result, result.message);
  }

  async renderMandateCheckoutPage(req, res, next) {
    const { key, order_id } = req.query;
    const keyId = key || process.env.RAZORPAY_KEY_ID || 'rzp_live_TTVmOdCGlRjqaK';
    const orderId = order_id || '';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sahayaone e-NACH Mandate Authorization</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #f8fafc; color: #1e293b; padding: 20px; text-align: center; }
    .card { background: white; padding: 30px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); max-width: 420px; width: 100%; }
    .btn { background: #2563eb; color: white; border: none; padding: 14px 24px; font-size: 16px; font-weight: 600; border-radius: 10px; cursor: pointer; width: 100%; margin-top: 20px; transition: background 0.2s; }
    .btn:hover { background: #1d4ed8; }
    .status { margin-top: 15px; font-size: 14px; color: #64748b; word-break: break-all; }
    .success { color: #16a34a; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h2 style="margin-top:0; color:#0f172a;">Sahayaone EMI Mandate</h2>
    <p style="color:#475569; font-size:14px;">Complete your e-NACH / UPI Autopay Mandate setup securely via Razorpay.</p>
    <div id="status" class="status">Initializing Razorpay Mandate Authorization...</div>
    <button class="btn" onclick="loadAndOpenRazorpay()">Proceed to Authorization</button>
    <a class="btn" style="background:#059669; text-decoration:none; display:inline-block; box-sizing:border-box; margin-top:12px;" href="https://checkout.razorpay.com/v1/checkout.html?key=${keyId}&order_id=${orderId}" target="_blank">Open Direct Razorpay Checkout ↗</a>
  </div>

  <script>
    const directRazorpayUrl = "https://checkout.razorpay.com/v1/checkout.html?key=${keyId}&order_id=${orderId}";

    function loadAndOpenRazorpay() {
      if (typeof Razorpay !== 'undefined') {
        openRazorpay();
        return;
      }

      document.getElementById('status').innerText = 'Opening Razorpay Checkout...';
      
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = function() {
        openRazorpay();
      };
      script.onerror = function() {
        // Automatic Seamless Fallback Redirect to Razorpay Official Hosted Page
        window.location.href = directRazorpayUrl;
      };
      document.head.appendChild(script);
    }

    function openRazorpay() {
      if (typeof Razorpay === 'undefined') {
        window.location.href = directRazorpayUrl;
        return;
      }

      const options = {
        key: "${keyId}",
        order_id: "${orderId}",
        name: "Sahayaone Fintech",
        description: "e-NACH Mandate Authorization",
        theme: { color: "#2563eb" },
        handler: function (response) {
          document.getElementById('status').className = 'status success';
          document.getElementById('status').innerHTML = '✓ Mandate Authorized Successfully!<br>Payment ID: ' + (response.razorpay_payment_id || response.razorpay_order_id);
        },
        modal: {
          ondismiss: function () {
            document.getElementById('status').innerHTML = 'Authorization window dismissed. Click button to retry.';
          }
        }
      };

      try {
        const rzp = new Razorpay(options);
        rzp.open();
      } catch (err) {
        window.location.href = directRazorpayUrl;
      }
    }

    window.onload = function() {
      if ("${orderId}") {
        loadAndOpenRazorpay();
      }
    };
  </script>
</body>
</html>
    `;

    return res.send(html);
  }
}

export const leadsController = new LeadsController();
