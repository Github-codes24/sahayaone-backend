import './env.config.js';

export const emailConfig = Object.freeze({
  provider: 'MSG91',
  fromName: process.env.MSG91_FROM_NAME || 'Sahayaone Credit',
  fromEmail: process.env.MSG91_FROM_EMAIL || 'no-reply@sahayaone.com',
  msg91: {
    authKey: process.env.MSG91_AUTH_KEY || '554888AWfuLg9q9pXN6a6b3658P1',
    fromEmail: process.env.MSG91_FROM_EMAIL || 'no-reply@sahayaone.com',
    fromName: process.env.MSG91_FROM_NAME || 'Sahayaone Credit',
    domain: process.env.MSG91_EMAIL_DOMAIN || 'sahayaone.com'
  },
  templates: Object.freeze({
    CUSTOMER_EMAIL_CHANGE_OLD: {
      templateId: 'customer_email_change_old',
      subject: 'Security Alert: Sahayaone Account Email Address Changed'
    },
    CUSTOMER_EMAIL_CHANGE_NEW: {
      templateId: 'customer_email_change_new',
      subject: 'Sahayaone Account Notification: Email Registered Successfully'
    },
    EMPLOYEE_FORGOT_PASSWORD_OTP: {
      templateId: 'employee_forgot_password_otp_2',
      subject: 'Sahayaone ERP - Password Reset Verification Code'
    },
    EMPLOYEE_PASSWORD_RESET_SUCCESS: {
      templateId: 'employee_password_reset_success',
      subject: 'Sahayaone ERP - Password Reset Successful'
    },
    ONBOARDING_FORGOT_PASSWORD_OTP: {
      templateId: 'onboarding_forgot_password_otp',
      subject: 'Sahayaone Onboarding Portal - Password Recovery Code'
    },
    ONBOARDING_PASSWORD_RESET_SUCCESS: {
      templateId: 'onboarding_password_reset_success',
      subject: 'Sahayaone Executive Portal - Password Reset Confirmation'
    },
    ONBOARDING_PASSWORD_CHANGED_PROFILE: {
      templateId: 'onboarding_password_changed_profile',
      subject: 'Sahayaone Executive Portal - Password Updated Successfully'
    },
    BANK_ONBOARDING_APPROVED: {
      templateId: 'bank_onboarding_approved',
      subject: 'Congratulations! Your Bank Onboarding Application Has Been Approved'
    },
    BANK_ONBOARDING_REJECTED: {
      templateId: 'bank_onboarding_rejected',
      subject: 'Important Notice: Update Required for Your Bank Onboarding Application'
    }
  })
});

