import { CustomError } from './custom.error.js';
import { HttpStatus } from '../constants/http-status.constant.js';
import { ErrorCode } from '../constants/error-code.constant.js';

const FRIENDLY_FIELD_LABELS = {
  email: 'Email address',
  phoneNumber: 'Mobile number',
  phone: 'Mobile number',
  primaryPhoneNumber: 'Primary mobile number',
  secondaryPhoneNumber: 'Secondary mobile number',
  panNumber: 'PAN number',
  pan: 'PAN number',
  aadhaarNumber: 'Aadhaar number',
  aadhaar: 'Aadhaar number',
  accountNumber: 'Bank account number',
  societyAccountNumber: 'Society account number',
  ifscCode: 'IFSC code',
  gstinNumber: 'GST number',
  gstin: 'GST number',
  businessProofNumber: 'Business proof number',
  merchantCode: 'Merchant code',
  code: 'Code',
  customerUniqueId: 'Customer ID',
  username: 'Username',
  name: 'Name',
  fullName: 'Full name',
  shopName: 'Shop name',
  referenceId: 'Reference ID',
  applicationId: 'Application ID',
  loanId: 'Loan ID'
};

function formatFieldLabel(rawField) {
  if (!rawField) return 'Record';
  const cleanField = rawField.includes('.') ? rawField.split('.').pop() : rawField;
  if (FRIENDLY_FIELD_LABELS[cleanField]) {
    return FRIENDLY_FIELD_LABELS[cleanField];
  }
  const spaced = cleanField.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export class DatabaseError extends CustomError {
  constructor(message = 'A database operation error occurred', details = null) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.DATABASE_ERROR, details);
    this.isOperational = false;
  }

  static handleMongooseError(err) {
    if (err.code === 11000 || err.code === 11001) {
      let field = '';
      let val = '';

      if (err.keyValue && typeof err.keyValue === 'object' && Object.keys(err.keyValue).length > 0) {
        field = Object.keys(err.keyValue)[0];
        val = err.keyValue[field];
      } else if (err.keyPattern && typeof err.keyPattern === 'object' && Object.keys(err.keyPattern).length > 0) {
        field = Object.keys(err.keyPattern)[0];
      } else if (typeof err.message === 'string') {
        const match = err.message.match(/index:\s+([^\s]+)/);
        if (match && match[1]) {
          field = match[1].split('_')[0];
        }
      }

      const label = formatFieldLabel(field);

      let userFriendlyMsg;
      if (val !== undefined && val !== null && String(val).trim().length > 0) {
        userFriendlyMsg = `${label} "${val}" is already registered. Please use a different ${label.toLowerCase()}.`;
      } else {
        userFriendlyMsg = `${label} is already registered. Please provide a different ${label.toLowerCase()}.`;
      }

      return new CustomError(
        userFriendlyMsg,
        HttpStatus.CONFLICT,
        ErrorCode.DATABASE_ERROR,
        { field, value: val }
      );
    }

    if (err.name === 'CastError') {
      const field = err.path || 'input';
      const label = formatFieldLabel(field);
      return new CustomError(
        `Invalid ${label.toLowerCase()} format provided. Please provide a valid value.`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.DATABASE_ERROR,
        { path: err.path, value: err.value }
      );
    }

    if (err.name === 'ValidationError' && err.errors) {
      const details = Object.keys(err.errors).map((key) => {
        let msg = err.errors[key].message || 'is invalid';
        msg = msg.replace(/^Path `([^`]+)`/, (match, p1) => formatFieldLabel(p1));
        return {
          field: key,
          message: msg
        };
      });

      const firstMessage = details[0]?.message || 'Please check and provide all required fields correctly.';
      return new CustomError(
        firstMessage,
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.VALIDATION_ERROR,
        details
      );
    }

    return new DatabaseError('A database operation error occurred. Please try again.', { originalError: err.message });
  }
}
