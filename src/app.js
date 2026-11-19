process.env.TZ = process.env.TZ || process.env.TIMEZONE || "Asia/Kolkata";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";
import rateLimit from "express-rate-limit";

import { corsOptions } from "./config/cors.config.js";
import { helmetOptions } from "./config/helmet.config.js";
import { rateLimitOptions } from "./config/server.config.js";
import { errorHandler } from "./middlewares/error-handler.middleware.js";
import { ApiError } from "./common/api.error.js";
import { stream } from "./utils/logger.util.js";
import { getHealth, getLiveness } from "./common/health.controller.js";

// Import Panel Routers
import superAdminAuthRouter from "./panels/super-admin/auth/index.js";
import superAdminProfileRouter from "./panels/super-admin/profile/index.js";
import superAdminDashboardRouter from "./panels/super-admin/dashboard/index.js";
import superAdminRolesPermissionsRouter from "./panels/super-admin/roles-permissions/index.js";
import superAdminBannersRouter from "./panels/super-admin/banners/index.js";
import superAdminCategoriesRouter from "./panels/super-admin/categories/index.js";
import superAdminBrandsRouter from "./panels/super-admin/brands/index.js";
import superAdminProductsRouter from "./panels/super-admin/products/index.js";
import superAdminModelsRouter from "./panels/super-admin/models/index.js";
import superAdminCustomersRouter from "./panels/super-admin/customers/index.js";
import superAdminLeadsRouter from "./panels/super-admin/leads/index.js";
import cooperativeBankRouter from "./panels/super-admin/co-operative-bank/index.js";
import merchantRouter from "./panels/super-admin/merchant/index.js";
import onboardingTeamRouter from "./panels/super-admin/onboarding-team/index.js";
import cashPaymentRouter from "./panels/super-admin/cash-payment/index.js";
import superAdminNotificationsRouter from "./panels/super-admin/notifications/index.js";
import superAdminPriceSettingsRouter from "./panels/super-admin/settings/price/index.js";
import superAdminSupportSettingsRouter from "./panels/super-admin/settings/support/index.js";
import employeeAuthRouter from "./panels/employee/auth/index.js";
import employeeLeadsRouter from "./panels/employee/leads/index.js";
import employeeCatalogRouter from "./panels/employee/catalog/index.js";
import employeeLoansRouter from "./panels/employee/loans/index.js";
import employeeProfileRouter from "./panels/employee/profile/index.js";
import employeeDashboardRouter from "./panels/employee/dashboard/index.js";
import employeeAttendanceRouter from "./panels/employee/attendance/index.js";
import employeeMerchantRouter from "./panels/employee/merchant/index.js";
import employeePigmyRouter from "./panels/employee/pigmy/index.js";
import employeeOnboardingRouter from "./panels/employee/onboarding/index.js";
import employeeKpaRouter from "./panels/employee/kpa/routes/employee-kpa.routes.js";
import onboardingAuthRouter from "./panels/onboarding/auth/index.js";
import onboardingBanksRouter from "./panels/onboarding/bank/index.js";
import onboardingProfileRouter from "./panels/onboarding/profile/index.js";
import superAdminBanksRouter from "./panels/super-admin/banks/index.js";
import superAdminAttendanceRouter from "./panels/super-admin/attendance/index.js";
import superAdminAttendanceReportRouter from "./panels/super-admin/attendance-report/index.js";
import onboardingAttendanceRouter from "./panels/onboarding/attendance/index.js";
import customerAuthRouter from "./panels/customer-mobile/auth/index.js";
import customerCatalogRouter from "./panels/customer-mobile/catalog/index.js";
import customerLoanApplicationRouter from "./panels/customer-mobile/loan-application/index.js";
import { customerEmiCardRouter } from "./panels/customer-mobile/emi-card/index.js";
import { customerBankAccountRouter } from "./panels/customer-mobile/bank-account/index.js";
import { customerLoanRouter } from "./panels/customer-mobile/loan/index.js";
import { customerPigmyRouter } from "./panels/customer-mobile/pigmy/index.js";
import { customerMerchantRouter } from "./panels/customer-mobile/merchant/index.js";
import { customerProfileRouter } from "./panels/customer-mobile/profile/index.js";

// Import Society Panel Routers
// Import Society Panel Routers
import societyAuthRouter from "./panels/society/auth/index.js";
import societyProfileRouter from "./panels/society/profile/index.js";
import societyBranchRouter from "./panels/society/branches/index.js";
import societyCibilScoreRouter from "./panels/society/cibilScore/index.js";
import societyPermissionRouter from "./panels/society/permissions/index.js";
import societyRoleRouter from "./panels/society/roles/index.js";
import societyEmployeeRouter from "./panels/society/employees/index.js";
import societyCashPaymentRouter from "./panels/society/cash-payment/index.js";
import societyCardsCreditRouter from "./panels/society/cards-credit/index.js";
import societyDashboardRouter from "./panels/society/dashboard/index.js";
import societyComponentRouter from "./panels/society/component.routes.js";
import societyMerchantRouter from "./panels/society/merchant/index.js";
import societyAttendanceRouter from "./panels/society/attendance/index.js";
import societyPigmyRouter from "./panels/society/pigmy/index.js";
import accountDeletionRouter from "./panels/account-deletion/index.js";
import {
  merchantAuthRouter,
  merchantLeadsRouter,
  merchantCatalogRouter,
  merchantKycVerificationRouter,
  merchantCibilScoreRouter,
  merchantVerificationCreditsRouter,
} from "./panels/merchant/index.js";
import unifiedWebhookRouter from "./payments/unified-webhook.routes.js";



//sip work
import schemeRouter from "./sip/routes/scheme.routes.js";
import sipRouter from "./sip/routes/sip.routes.js";
import bankSipRouter from "./sip/routes/bank-sip.routes.js";


const app = express();

// 1. Enable Security Headers via Helmet
app.use(helmet(helmetOptions));

// 2. Cross-Origin Resource Sharing
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// 3. Rate Limiting for Distributed Protection (Commented out)
// app.use(rateLimit(rateLimitOptions));

// 4. Request Body Parsers
app.use(
  express.json({
    limit: "50mb",
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 5. Database Injection Sanitization (NoSQL injection prevention)
app.use(mongoSanitize());

// 6. HTTP Request logger linked to Winston stream (skips health check polling noise)
app.use(
  morgan(":method :url :status :res[content-length] - :response-time ms", {
    stream,
    skip: (req) =>
      req.url === "/health" ||
      req.url.startsWith("/health/") ||
      req.url === "/api/v1/health",
  }),
);

// 7. Serves assets statically if needed
app.use("/public", express.static("public"));

// 7.1 DigiLocker Mock Gateway & Callback Route
app.get(["/public/mocks/digilocker-callback", "/public/mocks/digilocker-callback.html"], async (req, res) => {
  const { refid } = req.query;
  const redirect_url = req.query.redirect_url || req.query.redirectUrl;

  if (refid) {
    try {
      const KycModel = (await import("./database/models/kycVerification.model.js")).default;
      await KycModel.updateOne(
        { refid },
        { 
          $set: { 
            status: "VERIFIED", 
            verifiedAt: new Date(),
            "personalDetails.verificationStatus": "SUCCESS"
          } 
        }
      );
    } catch (e) {
      // Ignore mock db update errors
    }
  }

  if (redirect_url) {
    let target = redirect_url.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = `https://${target}`;
    }
    const sep = target.includes('?') ? '&' : '?';
    return res.redirect(`${target}${sep}refid=${encodeURIComponent(refid || '')}&status=SUCCESS`);
  }

  return res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>DigiLocker Verification Success</title></head>
      <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f4f6f8;">
        <div style="background: #fff; padding: 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; max-width: 400px;">
          <h2 style="color: #22c55e;">✓ DigiLocker KYC Verified</h2>
          <p style="color: #64748b;">Session Reference ID: <strong>${refid || 'N/A'}</strong></p>
          <p style="color: #334155;">Verification is successfully recorded. You may close this window and return to your application.</p>
        </div>
      </body>
    </html>
  `);
});

// 7.5 URL Normalization Middleware (rewrite /v1/* to /api/v1/* for API compatibility)
app.use((req, res, next) => {
  if (req.url.startsWith("/v1/")) {
    req.url = "/api" + req.url;
  }
  next();
});

// 8. Mount Modular Panel Routes
app.use("/api/v1/super-admin/auth", superAdminAuthRouter);
app.use("/api/v1/super-admin/profile", superAdminProfileRouter);
app.use("/api/v1/super-admin/dashboard", superAdminDashboardRouter);
app.use(
  "/api/v1/super-admin/roles-permissions",
  superAdminRolesPermissionsRouter,
);
app.use("/api/v1/super-admin/banners", superAdminBannersRouter);
app.use("/api/v1/super-admin/categories", superAdminCategoriesRouter);
app.use("/api/v1/super-admin/brands", superAdminBrandsRouter);
app.use("/api/v1/super-admin/products", superAdminProductsRouter);
app.use("/api/v1/super-admin/models", superAdminModelsRouter);
app.use("/api/v1/super-admin/customers", superAdminCustomersRouter);
app.use("/api/v1/super-admin/leads", superAdminLeadsRouter);
app.use("/api/v1/super-admin/co-operative-bank", cooperativeBankRouter);
app.use("/api/v1/super-admin/merchant", merchantRouter);
app.use("/api/v1/super-admin/onboarding-team", onboardingTeamRouter);
app.use("/api/v1/super-admin/cash-payment", cashPaymentRouter);
app.use("/api/v1/super-admin/notifications", superAdminNotificationsRouter);
app.use("/api/v1/super-admin/settings/price", superAdminPriceSettingsRouter);
app.use(
  "/api/v1/super-admin/settings/support",
  superAdminSupportSettingsRouter,
);
app.use("/api/v1/employee/auth", employeeAuthRouter);
app.use("/api/v1/employee/leads", employeeLeadsRouter);
app.use("/api/v1/employee/catalog", employeeCatalogRouter);
app.use("/api/v1/employee/loans", employeeLoansRouter);
app.use("/api/v1/employee/profile", employeeProfileRouter);
app.use("/api/v1/employee/dashboard", employeeDashboardRouter);
app.use("/api/v1/employee/attendance", employeeAttendanceRouter);
app.use("/api/v1/employee/merchants", employeeMerchantRouter);
app.use("/api/v1/employee/pigmy-customers", employeePigmyRouter);
app.use("/api/v1/employee/pigmy", employeePigmyRouter);
app.use("/api/v1/employee/onboarding", employeeOnboardingRouter);
app.use("/api/v1/employee", employeeKpaRouter);
app.use("/api/v1/onboarding/auth", onboardingAuthRouter);
app.use("/api/v1/onboarding/banks", onboardingBanksRouter);
app.use("/api/v1/onboarding/profile", onboardingProfileRouter);
app.use("/api/v1/onboarding/attendance", onboardingAttendanceRouter);
app.use("/api/v1/super-admin/banks", superAdminBanksRouter);
app.use("/api/v1/super-admin/attendance", superAdminAttendanceRouter);
app.use("/api/v1/super-admin/attendance-report", superAdminAttendanceReportRouter);
app.use("/api/v1/customer/auth", customerAuthRouter);
app.use("/api/v1/customer-mobile/auth", customerAuthRouter);
app.use("/api/v1/customer/catalog", customerCatalogRouter);
app.use("/api/v1/customer-mobile/catalog", customerCatalogRouter);
app.use("/api/v1/customer/loans/applications", customerLoanApplicationRouter);
app.use("/api/v1/customer-mobile/loans/applications", customerLoanApplicationRouter);
app.use("/api/v1/customer/emi-card", customerEmiCardRouter);
app.use("/api/v1/customer-mobile/emi-card", customerEmiCardRouter);
app.use("/api/v1/customer/bank-accounts", customerBankAccountRouter);
app.use("/api/v1/customer-mobile/bank-accounts", customerBankAccountRouter);
app.use("/api/v1/customer/loans", customerLoanRouter);
app.use("/api/v1/customer-mobile/loans", customerLoanRouter);
app.use("/api/v1/customer/pigmy", customerPigmyRouter);
app.use("/api/v1/customer-mobile/pigmy", customerPigmyRouter);
app.use("/api/v1/customer/merchant", customerMerchantRouter);
app.use("/api/v1/customer-mobile/merchant", customerMerchantRouter);
app.use("/api/v1/customer/profile", customerProfileRouter);
app.use("/api/v1/customer-mobile/profile", customerProfileRouter);
app.use("/api/v1/customer/me", customerProfileRouter);
app.use("/api/v1/customer-mobile/me", customerProfileRouter);
app.use("/api/v1/society/auth", societyAuthRouter);
app.use("/api/v1/society/profile", societyProfileRouter);
app.use("/api/v1/society/branches", societyBranchRouter);
app.use("/api/v1/society/cibil-score", societyCibilScoreRouter);
app.use("/api/v1/society/permissions", societyPermissionRouter);
app.use("/api/v1/society/roles", societyRoleRouter);
app.use("/api/v1/society/employees", societyEmployeeRouter);
app.use("/api/v1/society/cash-payment", societyCashPaymentRouter);
app.use("/api/v1/society/cards-credit", societyCardsCreditRouter);
app.use("/api/v1/society/dashboard", societyDashboardRouter);
app.use("/api/v1/society/merchant", societyMerchantRouter);
app.use("/api/v1/society/merchants", societyMerchantRouter);
app.use("/api/v1/society/attendance", societyAttendanceRouter);
app.use("/api/v1/society/pigmy-customers", societyPigmyRouter);
app.use("/api/v1/society/pigmy", societyPigmyRouter);
app.use("/api/v1/society", societyComponentRouter);
app.use("/api/v1/account-deletion", accountDeletionRouter);
app.use("/api/v1/deletion", accountDeletionRouter);
app.use("/api/v1/webhooks", unifiedWebhookRouter);
app.use("/api/v1/merchant/auth", merchantAuthRouter);
app.use("/api/v1/merchant/leads", merchantLeadsRouter);
app.use("/api/v1/merchant/catalog", merchantCatalogRouter);
app.use("/api/v1/merchant/kyc-verification", merchantKycVerificationRouter);
app.use("/api/v1/merchant/cibil-score", merchantCibilScoreRouter);
app.use("/api/v1/merchant/verification-credits", merchantVerificationCreditsRouter);
app.use("/api/v1/merchant", merchantAuthRouter);


//sip call
app.use("/api/v1/sip/schemes", schemeRouter);
app.use("/api/v1/sip/bank", bankSipRouter);
app.use("/api/v1/sip", sipRouter);


// Health check endpoints for Docker, Kubernetes, and external monitors
app.get("/health", getHealth);
app.get("/health/live", getLiveness);
app.get("/api/v1/health", getHealth);

// Health check endpoint for deployment keep-alives and monitoring
app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Sahayaone Enterprise ERP API Gateway is active.",
    timestamp: new Date(),
  });
});

// 9. Match Unregistered Routes -> Throw 404
app.use("*", (req, res, next) => {
  const targetResource = req.originalUrl || req.baseUrl;
  next(
    ApiError.notFound(
      `Cannot ${req.method} requested resource: ${targetResource}`,
    ),
  );
});

// 10. Global Enterprise Error Interceptor Middleware
app.use(errorHandler);

export default app;
