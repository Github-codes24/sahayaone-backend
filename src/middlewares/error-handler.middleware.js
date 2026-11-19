import { envConfig } from '../config/env.config.js';
import { CustomError } from '../common/custom.error.js';
import { DatabaseError } from '../common/database.error.js';
import { logger } from '../utils/logger.util.js';
import { HttpStatus } from '../constants/http-status.constant.js';
import { ErrorCode } from '../constants/error-code.constant.js';

export function errorHandler(err, req, res, next) {
  let error = err;

  logger.error(`${req.method} ${req.originalUrl} - Pipeline exception: ${err.message}`, {
    stack: err.stack,
    details: err.details || null
  });

  if (!(err instanceof CustomError)) {
    if (err.name === 'ValidationError' || err.name === 'CastError' || err.code === 11000) {
      error = DatabaseError.handleMongooseError(err);
    }
  }

  if (!(error instanceof CustomError)) {
    const statusCode = err.statusCode || err.status || HttpStatus.INTERNAL_SERVER_ERROR;
    error = new CustomError(
      err.message || 'An unexpected database or code error occurred',
      statusCode,
      err.code || ErrorCode.UNEXPECTED_ERROR,
      err.details || { name: err.name, stack: err.stack }
    );
    error.isOperational = false;
  }

  return res.status(error.statusCode).json({
    success: false,
    statusCode: error.statusCode,
    errorCode: error.errorCode,
    message: error.message,
    details: error.details,
    stack: error.stack
  });
}
