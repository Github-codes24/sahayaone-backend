import { BaseController } from '../../../../common/base.controller.js';
import { bankOnboardingService } from '../services/bank-onboarding.service.js';
import { Bank } from '../../../../models/bank.model.js';

export class BankOnboardingController extends BaseController {
  constructor() {
    super();
    this.getDashboardStats = this.catchAsync(this.getDashboardStats.bind(this));
    this.listBanks = this.catchAsync(this.listBanks.bind(this));
    this.saveGeneralInfo = this.catchAsync(this.saveGeneralInfo.bind(this));
    this.updateGeneralInfo = this.catchAsync(this.updateGeneralInfo.bind(this));
    this.uploadDocuments = this.catchAsync(this.uploadDocuments.bind(this));
    this.saveBankAccount = this.catchAsync(this.saveBankAccount.bind(this));
    this.saveFeatures = this.catchAsync(this.saveFeatures.bind(this));
    this.calculatePricing = this.catchAsync(this.calculatePricing.bind(this));
    this.initiatePayment = this.catchAsync(this.initiatePayment.bind(this));
    this.verifyPayment = this.catchAsync(this.verifyPayment.bind(this));
    this.resubmitForVerification = this.catchAsync(this.resubmitForVerification.bind(this));
    this.getBankDetails = this.catchAsync(this.getBankDetails.bind(this));
    this.createBranch = this.catchAsync(this.createBranch.bind(this));
    this.allocateCredits = this.catchAsync(this.allocateCredits.bind(this));
    this.listBranches = this.catchAsync(this.listBranches.bind(this));
    this.getCreditLogs = this.catchAsync(this.getCreditLogs.bind(this));
    this.handlePaymentWebhook = this.catchAsync(this.handlePaymentWebhook.bind(this));
    this.renderMockCheckout = this.catchAsync(this.renderMockCheckout.bind(this));
    this.renderPaymentCallback = this.catchAsync(this.renderPaymentCallback.bind(this));
    this.getBanners = this.catchAsync(this.getBanners.bind(this));
  }

  async getBanners(req, res, next) {
    const result = await bankOnboardingService.getBanners(req.query);
    return this.sendResponse(res, 200, result, 'Onboarding banners successfully retrieved.');
  }

  async getDashboardStats(req, res, next) {
    const result = await bankOnboardingService.getDashboardStats();
    return this.sendResponse(res, 200, result.stats, 'Dashboard onboarding counts successfully retrieved.');
  }

  async listBanks(req, res, next) {
    const search = req.query.searchName || req.query.search || req.query.name || '';
    const result = await bankOnboardingService.listBanks(search, req.query);
    return this.sendResponse(
      res,
      200,
      {
        banks: result.banks,
        meta: result.meta
      },
      'Onboarded bank list successfully retrieved.'
    );
  }

  async saveGeneralInfo(req, res, next) {
    const creatorId = req.user?.userId || req.user?.id || null;
    const result = await bankOnboardingService.saveGeneralInfo(req.body, creatorId);
    return this.sendResponse(res, 200, result, 'Bank general info successfully created.');
  }

  async updateGeneralInfo(req, res, next) {
    const { id } = req.params;
    const updaterId = req.user?.userId || req.user?.id || null;
    const result = await bankOnboardingService.updateGeneralInfo(id, req.body, updaterId);
    return this.sendResponse(res, 200, result, 'Bank general info successfully updated.');
  }

  async uploadDocuments(req, res, next) {
    const { id } = req.params;
    const updaterId = req.user?.userId || req.user?.id || null;
    const result = await bankOnboardingService.uploadDocuments(id, req.body, updaterId);
    return this.sendResponse(res, 200, result, 'Bank onboarding documents uploaded successfully.');
  }

  async saveBankAccount(req, res, next) {
    const { id } = req.params;
    const updaterId = req.user?.userId || req.user?.id || null;
    const result = await bankOnboardingService.saveBankAccount(id, req.body, updaterId);
    return this.sendResponse(res, 200, result, 'Bank account info successfully saved.');
  }

  async saveFeatures(req, res, next) {
    const { id } = req.params;
    const result = await bankOnboardingService.saveFeatures(id, req.body);
    return this.sendResponse(res, 200, result, 'Chosen features successfully saved.');
  }

  async calculatePricing(req, res, next) {
    const { id } = req.params;
    const result = await bankOnboardingService.calculatePricing(id, req.body);
    return this.sendResponse(res, 200, result.priceBreakdown, 'Bank onboarding pricing breakdown calculated.');
  }

  async initiatePayment(req, res, next) {
    const { id } = req.params;
    const result = await bankOnboardingService.initiatePayment(id, req.body);
    return this.sendResponse(res, 200, result, 'Bank onboarding payment successfully initiated.');
  }

  async verifyPayment(req, res, next) {
    const { id } = req.params;
    const result = await bankOnboardingService.verifyPayment(id, req.body, req.user?.userId || req.user?.id);
    return this.sendResponse(res, 200, result, 'Bank onboarding payment successfully verified.');
  }

  async resubmitForVerification(req, res, next) {
    const { id } = req.params;
    const result = await bankOnboardingService.resubmitForVerification(id, req.body);
    return this.sendResponse(res, 200, result, 'Bank onboarding application successfully re-submitted for Super Admin verification.');
  }

  async getBankDetails(req, res, next) {
    const { id } = req.params;
    const result = await bankOnboardingService.getBankDetails(id);
    return this.sendResponse(res, 200, result.bank, 'Bank profile details successfully retrieved.');
  }

  async createBranch(req, res, next) {
    const { id } = req.params;
    const result = await bankOnboardingService.createBranch(id, req.body);
    return this.sendResponse(res, 200, result, 'Branch successfully created with allocated credits.');
  }

  async allocateCredits(req, res, next) {
    const { id, branchId } = req.params;
    const result = await bankOnboardingService.allocateCredits(id, branchId, req.body);
    return this.sendResponse(res, 200, result, 'Credits successfully distributed to branch.');
  }

  async listBranches(req, res, next) {
    const { id } = req.params;
    const result = await bankOnboardingService.listBranches(id);
    return this.sendResponse(res, 200, result.branches, 'Bank branch list successfully retrieved.');
  }

  async getCreditLogs(req, res, next) {
    const { id } = req.params;
    const result = await bankOnboardingService.getCreditLogs(id);
    return this.sendResponse(res, 200, result.logs, 'Credit transaction logs successfully retrieved.');
  }

  async handlePaymentWebhook(req, res, next) {
    const result = await bankOnboardingService.handlePaymentWebhook(req.headers, req.body, req.rawBody);
    return this.sendResponse(res, 200, result, 'Payment webhook processed successfully.');
  }

  async renderMockCheckout(req, res, next) {
    const { id } = req.params;
    const { orderId, amount } = req.query;
    const bank = await Bank.findById(id);
    if (!bank) {
      return res.status(404).send('<h1>Bank record not found</h1>');
    }

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sahayaone Secure Sandbox Checkout</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: rgba(255, 255, 255, 0.03);
      --border: rgba(255, 255, 255, 0.08);
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --success: #10b981;
      --danger: #ef4444;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Outfit', sans-serif;
    }

    body {
      background-color: var(--bg);
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
      overflow-x: hidden;
    }

    .checkout-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      backdrop-filter: blur(16px);
      border-radius: 24px;
      width: 100%;
      max-width: 440px;
      padding: 32px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .header {
      text-align: center;
      margin-bottom: 28px;
    }

    .logo {
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(135deg, #a5b4fc, #6366f1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 6px;
      letter-spacing: -0.5px;
    }

    .subtitle {
      font-size: 14px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }

    .order-info {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 28px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      font-size: 14px;
    }

    .info-row:last-child {
      margin-bottom: 0;
      border-top: 1px dashed var(--border);
      padding-top: 12px;
    }

    .label {
      color: var(--text-muted);
    }

    .val {
      font-weight: 600;
    }

    .amount-val {
      font-size: 18px;
      color: #818cf8;
      font-weight: 700;
    }

    .payment-methods {
      margin-bottom: 28px;
    }

    .method-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 12px;
    }

    .method-option {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-bottom: 10px;
    }

    .method-option:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.15);
    }

    .method-option.selected {
      border-color: var(--primary);
      background: rgba(99, 102, 241, 0.08);
    }

    .radio-dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .method-option.selected .radio-dot {
      border-color: var(--primary);
    }

    .method-option.selected .radio-dot::after {
      content: '';
      width: 8px;
      height: 8px;
      background: var(--primary);
      border-radius: 50%;
    }

    .btn {
      width: 100%;
      border: none;
      border-radius: 14px;
      padding: 16px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-bottom: 12px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
    }

    .btn-success {
      background: var(--success);
      color: #fff;
    }

    .btn-success:hover {
      background: #059669;
      transform: translateY(-1px);
    }

    .btn-danger {
      background: transparent;
      color: var(--danger);
      border: 1px solid var(--danger);
    }

    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.05);
    }

    .btn:active {
      transform: translateY(0);
    }

    .loader {
      display: none;
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: spin 0.8s ease-in-out infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .status-msg {
      text-align: center;
      font-size: 14px;
      margin-top: 12px;
      display: none;
    }
  </style>
</head>
<body>

  <div class="checkout-card" id="checkoutCard">
    <div class="header">
      <div class="logo">SAHAYAONE PAY</div>
      <div class="subtitle">Secure Sandbox Checkout</div>
    </div>

    <div class="order-info">
      <div class="info-row">
        <span class="label">Cooperative Bank</span>
        <span class="val">${bank.name}</span>
      </div>
      <div class="info-row">
        <span class="label">Order ID</span>
        <span class="val">${orderId || 'N/A'}</span>
      </div>
      <div class="info-row">
        <span class="label">Amount Payable</span>
        <span class="val amount-val">₹${amount || '0'}</span>
      </div>
    </div>

    <div class="payment-methods">
      <div class="method-title">Select Sandbox Payment Option</div>
      <div class="method-option selected">
        <div class="radio-dot"></div>
        <span>Credit / Debit Card Simulation</span>
      </div>
      <div class="method-option">
        <div class="radio-dot"></div>
        <span>UPI / NetBanking Simulation</span>
      </div>
    </div>

    <button class="btn btn-success" id="payBtn" onclick="triggerWebhook('SUCCESS')">
      <span class="btn-text">Simulate Successful Payment</span>
      <div class="loader" id="payLoader"></div>
    </button>

    <button class="btn btn-danger" id="failBtn" onclick="triggerWebhook('FAILED')">
      <span>Simulate Failed Payment</span>
    </button>

    <div class="status-msg" id="statusMsg"></div>
  </div>

  <script>
    async function triggerWebhook(status) {
      const payBtn = document.getElementById('payBtn');
      const failBtn = document.getElementById('failBtn');
      const payLoader = document.getElementById('payLoader');
      const statusMsg = document.getElementById('statusMsg');

      payBtn.disabled = true;
      failBtn.disabled = true;
      if (status === 'SUCCESS') {
        payLoader.style.display = 'block';
      }

      try {
        const payload = {
          bankId: "${id}",
          gatewayOrderId: "${orderId}",
          transactionId: "txn_sim_" + Math.floor(10000000 + Math.random() * 90000000),
          status: status,
          amount: Number("${amount}")
        };

        const response = await fetch('/api/v1/onboarding/banks/webhooks/payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-mock-signature': 'mock_secret_signature_key'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        payLoader.style.display = 'none';
        statusMsg.style.display = 'block';

        if (response.ok && data.success) {
          statusMsg.style.color = 'var(--success)';
          statusMsg.innerHTML = status === 'SUCCESS' 
            ? '✓ Payment Successful! Auto-crediting stocks. Redirecting...'
            : '✓ Simulating cancellation... Redirecting...';
          
          // Redirect after 2 seconds to simulate successful app-recovery redirection
          setTimeout(() => {
            window.location.href = '/api/v1/onboarding/banks/${id}';
          }, 2000);
        } else {
          throw new Error(data.message || 'Webhook simulation failed.');
        }
      } catch (err) {
        payLoader.style.display = 'none';
        payBtn.disabled = false;
        failBtn.disabled = false;
        statusMsg.style.display = 'block';
        statusMsg.style.color = 'var(--danger)';
        statusMsg.innerHTML = 'Error: ' + err.message;
      }
    }
  </script>
</body>
</html>
    `;
    return res.send(html);
  }

  async renderPaymentCallback(req, res, next) {
    const { razorpay_payment_link_status, status } = req.query;
    
    // Support status from both Stripe/PayPal query or Razorpay link status
    const isSuccess = razorpay_payment_link_status === 'paid' || status === 'success';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Status - Sahayaone</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      background-color: #0b0f19;
      color: #f3f4f6;
      font-family: 'Outfit', sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .status-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 40px 32px;
      text-align: center;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    .icon-success {
      color: #10b981;
    }
    .icon-failed {
      color: #ef4444;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    p {
      color: #9ca3af;
      font-size: 15px;
      line-height: 1.5;
      margin-bottom: 28px;
    }
    .btn {
      display: inline-block;
      width: 100%;
      background: #6366f1;
      color: #fff;
      border: none;
      border-radius: 12px;
      padding: 14px;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .btn:hover {
      background: #4f46e5;
    }
  </style>
</head>
<body>
  <div class="status-card">
    <div class="icon ${isSuccess ? 'icon-success' : 'icon-failed'}">
      ${isSuccess ? '✓' : '✗'}
    </div>
    <h1>${isSuccess ? 'Payment Successful' : 'Payment Failed'}</h1>
    <p>${isSuccess ? 'Your onboarding deposit has been securely processed. We are setting up your cooperative bank profile.' : 'The transaction was unsuccessful or cancelled. Please try initiating checkout again.'}</p>
    <button class="btn" onclick="closeWebView()">Return to App</button>
  </div>

  <script>
    function closeWebView() {
      // Post message back to React Native WebView context
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          event: 'payment_complete', 
          status: '${isSuccess ? 'success' : 'failed'}' 
        }));
      } else {
        // Fallback for desktop browsers
        window.close();
      }
    }
    // Auto-trigger message post immediately on load so webview can capture it instantly
    window.onload = function() {
      if (window.ReactNativeWebView) {
        setTimeout(closeWebView, 1500);
      }
    }
  </script>
</body>
</html>
    `;
    return res.send(html);
  }
}

export const bankOnboardingController = new BankOnboardingController();
