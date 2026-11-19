import "./env.config.js";
import { msg91TemplateConfig } from "./panel-control.config.js";

export const smsConfig = Object.freeze({
  provider: process.env.SMS_PROVIDER || "MSG91",
  msg91: {
    authKey: (process.env.MSG91_AUTH_KEY || "554888AWfuLg9q9pXN6a6b3658P1").trim(),
    templateId: process.env.MSG91_TEMPLATE_ID || null,
  },
  panels: msg91TemplateConfig,
  templates: Object.freeze({
    CUSTOMER_LOGIN_OTP: {
      templateId: msg91TemplateConfig.CUSTOMER_PANEL.VERIFY_MOBILE_OTP,
      variables: ["otp", "OTP", "expiry"],
    },
    CUSTOMER_RESEND_OTP: {
      templateId: msg91TemplateConfig.CUSTOMER_PANEL.RESEND_OTP,
      variables: ["otp", "OTP", "expiry"],
    },
    CUSTOMER_FORGOT_MPIN_OTP: {
      templateId: msg91TemplateConfig.CUSTOMER_PANEL.FORGOT_MPIN_OTP,
      variables: ["otp", "OTP", "expiry"],
    },
    EMPLOYEE_LOGIN_OTP: {
      templateId: msg91TemplateConfig.EMPLOYEE_PANEL.LOGIN_OTP,
      variables: ["otp", "OTP", "expiry"],
    },
    ONBOARDING_LOGIN_OTP: {
      templateId: msg91TemplateConfig.ONBOARDING_PANEL.LOGIN_OTP,
      variables: ["otp", "OTP", "expiry"],
    },
    LOAN_DISBURSAL_OTP: {
      templateId: msg91TemplateConfig.EMPLOYEE_PANEL.LOAN_DISBURSAL_OTP,
      variables: ["applicationId", "otp", "OTP"],
    },
    CUSTOMER_LOOKUP_OTP: {
      templateId: msg91TemplateConfig.CUSTOMER_PANEL.LOOKUP_OTP,
      variables: ["otp", "expiry", "OTP"],
    },
    DOWN_PAYMENT_OTP: {
      templateId: msg91TemplateConfig.EMPLOYEE_PANEL.DOWN_PAYMENT_OTP,
      variables: ["otp", "OTP", "loanId"],
    },
    GENERAL_ALERT: {
      templateId: msg91TemplateConfig.EMPLOYEE_PANEL.GENERAL_ALERT,
      variables: ["amount", "date", "loanId"],
    },
    CASH_COLLECT_OTP: {
      templateId: msg91TemplateConfig.ONBOARDING_PANEL.CASH_COLLECT_OTP,
      variables: ["amount", "otp", "expiry", "OTP"],
    },
    ONBOARDING_RECOVERY_EMAIL: {
      templateId: msg91TemplateConfig.ONBOARDING_PANEL.RECOVERY_EMAIL,
      variables: ["otp", "OTP"],
    },
  }),
});

export { msg91TemplateConfig };


