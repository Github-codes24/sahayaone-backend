import { CustomError } from './custom.error.js';
import { HttpStatus } from '../constants/http-status.constant.js';
import { ErrorCode } from '../constants/error-code.constant.js';

export class ValidationError extends CustomError {
  constructor(message = 'Input parameters failed schema validation rules', details = null) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.VALIDATION_ERROR, details);
  }

  static fromJoi(joiError) {
    const details = joiError.details.map((item) => ({
      field: item.context.key,
      message: item.message.replace(/['"]/g, ''),
      location: item.path.join('.')
    }));
    const firstMessage = details[0]?.message || 'Please check and provide all required fields correctly.';
    return new ValidationError(firstMessage, details);
  }
}
