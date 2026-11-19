import { HttpStatus } from '../constants/http-status.constant.js';

export const responseHandler = {
  success: (res, message = 'Success', data = null, statusCode = HttpStatus.OK) => {
    return res.status(statusCode).json({
      success: true,
      statusCode,
      message,
      data
    });
  },

  created: (res, message = 'Resource created', data = null) => {
    return responseHandler.success(res, message, data, HttpStatus.CREATED);
  },

  noContent: (res) => {
    return res.status(HttpStatus.NO_CONTENT).send();
  }
};
