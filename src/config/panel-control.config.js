import "./env.config.js";

export const panelControlConfig = Object.freeze({
  CUSTOMER_PANEL: {
    OTP: "TEST", // "LIVE" or "TEST"
    EMAIL: "TEST", // "LIVE" or "TEST"
    PAYMENT: "TEST", // "LIVE" or "TEST"
  },
  EMPLOYEE_PANEL: {
    OTP: "TEST", // "LIVE" or "TEST"
    EMAIL: "TEST", // "LIVE" or "TEST"
    PAYMENT: "TEST", // "LIVE" or "TEST"
  },
  ONBOARDING_PANEL: {
    OTP: "LIVE", // "LIVE" or "TEST"
    EMAIL: "LIVE", // "LIVE" or "TEST"
    PAYMENT: "LIVE", // "LIVE" or "TEST"
  },
  SUPER_ADMIN_PANEL: {
    OTP: "TEST", // "LIVE" or "TEST"
    EMAIL: "TEST", // "LIVE" or "TEST"
    PAYMENT: "TEST", // "LIVE" or "TEST"
  },
  MERCHANT_PANEL: {
    OTP: "TEST", // "LIVE" or "TEST"
    EMAIL: "TEST", // "LIVE" or "TEST"
    PAYMENT: "TEST", // "LIVE" or "TEST"
  },
});

export const msg91TemplateConfig = Object.freeze({
  CUSTOMER_PANEL: {
    VERIFY_MOBILE_OTP: "6a6b319f31ce83ca09044982",
    RESEND_OTP: "6a79804951f96e2b6d029e52",
    FORGOT_MPIN_OTP: "6a7982eca2cadb62ad0db6f4",
    LOOKUP_OTP: "6a7982eca2cadb62ad0db6f4",
    GENERAL_ALERT: "65a7f23c91a03e1e9c2b4d77",
    EMAIL_CHANGE_OLD: "customer_email_change_old",
    EMAIL_CHANGE_NEW: "customer_email_change_new",
  },
  EMPLOYEE_PANEL: {
    LOGIN_OTP: "6a7981bd7e54476a2404b202",
    FORGOT_PASSWORD_OTP: "employee_forgot_password_otp_2",
    PASSWORD_RESET_SUCCESS: "employee_password_reset_success",
    LOAN_DISBURSAL_OTP: "65a7f23c91a03e1e9c2b4d44",
    DOWN_PAYMENT_OTP: "65a7f23c91a03e1e9c2b4d66",
    GENERAL_ALERT: "65a7f23c91a03e1e9c2b4d77",
  },
  ONBOARDING_PANEL: {
    LOGIN_OTP: "6a798385bdad09c3560e7452",
    CASH_COLLECT_OTP: "6a8932293bfa052e2a0ce4a3",
    FORGOT_PASSWORD_OTP: "onboarding_forgot_password_otp",
    PASSWORD_RESET_SUCCESS: "onboarding_password_reset_success",
    PASSWORD_CHANGED_PROFILE: "onboarding_password_changed_profile",
    RECOVERY_EMAIL: "onboarding_forgot_password_otp",
  },
  SUPER_ADMIN_PANEL: {
    BANK_ONBOARDING_APPROVED: "bank_onboarding_approved",
    BANK_ONBOARDING_REJECTED: "bank_onboarding_rejected",
    GENERAL_ALERT: "65a7f23c91a03e1e9c2b4d77",
  },
  SOCIETY_PANEL: {
    FORGOT_MPIN_OTP: "onboarding_forgot_password_otp",
    FORGOT_PASSWORD_OTP: "onboarding_forgot_password_otp",
    LOAN_DISBURSAL_OTP: "65a7f23c91a03e1e9c2b4d44",
    DOWN_PAYMENT_OTP: "65a7f23c91a03e1e9c2b4d66",
    OFFER_LETTER: "hr_employee_offer_letter_notification",
    CONFIRMATION_LETTER: "hr_employee_confirmation_letter_notification",
    PERFORMANCE_LETTER: "template_20_08_2026_16_08",
    PROMOTION_LETTER: "hr_employee_promotion_letter_notification",
    TRANSFER_LETTER: "hr_employee_transfer_letter_notification",
    SALARY_SLIP: "hr_employee_salary_slip_notification_2",
    INCREMENT_LETTER: "hr_employee_salary_increment_notification",
    TERMINATION_LETTER: "hr_employee_termination_letter_notification",
    MERCHANT_APPROVAL_CUSTOMER: "merchant_lead_approval_customer_notification",
    MERCHANT_APPROVAL_EXECUTIVE: "merchant_lead_approval_executive_notification",
    MERCHANT_REJECTION_CUSTOMER: "merchant_lead_rejection_customer_notification",
    MERCHANT_REJECTION_EXECUTIVE: "merchant_lead_rejection_executive_notification",
    PIGMY_APPROVAL_CUSTOMER: "pigmy_deposit_lead_approval_customer_notification",
    PIGMY_APPROVAL_EXECUTIVE: "pigmy_deposit_lead_approval_executive_notification",
    PIGMY_REJECTION_CUSTOMER: "pigmy_deposit_lead_rejection_customer_notification",
    PIGMY_REJECTION_EXECUTIVE: "pigmy_deposit_lead_rejection_executive_notification"
  },
});
