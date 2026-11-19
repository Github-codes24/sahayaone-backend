import { CustomError } from './custom.error.js';
import { HttpStatus } from '../constants/http-status.constant.js';
import { ErrorCode } from '../constants/error-code.constant.js';

export class ApiError extends CustomError {
  constructor(message, statusCode, errorCode, details = null) {
    super(message, statusCode, errorCode, details);
  }

  static badRequest(message, errorCode = ErrorCode.UNEXPECTED_ERROR, details = null) {
    return new ApiError(message, HttpStatus.BAD_REQUEST, errorCode, details);
  }

  static unauthorized(message = 'Authentication credentials invalid or missing', errorCode = ErrorCode.AUTH_UNAUTHORIZED) {
    return new ApiError(message, HttpStatus.UNAUTHORIZED, errorCode);
  }

  static forbidden(message = 'Access privileges insufficient to view this resource', errorCode = ErrorCode.AUTH_FORBIDDEN) {
    return new ApiError(message, HttpStatus.FORBIDDEN, errorCode);
  }

  static notFound(message = 'Requested resource not found', errorCode = ErrorCode.RESOURCE_NOT_FOUND) {
    return new ApiError(message, HttpStatus.NOT_FOUND, errorCode);
  }

  static conflict(message, errorCode = ErrorCode.UNEXPECTED_ERROR) {
    return new ApiError(message, HttpStatus.CONFLICT, errorCode);
  }

  static unprocessable(message, errorCode = ErrorCode.VALIDATION_ERROR, details = null) {
    return new ApiError(message, HttpStatus.UNPROCESSABLE_ENTITY, errorCode, details);
  }

  static tooManyRequests(message = 'Rate limit reached, please slow down', errorCode = ErrorCode.OTP_LIMIT_EXCEEDED) {
    return new ApiError(message, HttpStatus.TOO_MANY_REQUESTS, errorCode);
  }

  static internal(message = 'An unexpected system error occurred', errorCode = ErrorCode.UNEXPECTED_ERROR) {
    const err = new ApiError(message, HttpStatus.INTERNAL_SERVER_ERROR, errorCode);
    err.isOperational = false;
    return err;
  }
}
