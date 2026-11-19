import { HttpStatus } from '../constants/http-status.constant.js';

export class BaseController {
  catchAsync(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
//askcjnasjkcn
  sendResponse(res, statusCode = HttpStatus.OK, data = null, message = 'Operation completed successfully') {
    return res.status(statusCode).json({
      success: true,
      statusCode,
      message,
      data
    });
  }

  sendSuccess(res, data = null, message = 'Operation completed successfully') {
    return this.sendResponse(res, HttpStatus.OK, data, message);
  }

  sendCreated(res, data = null, message = 'Resource created successfully') {
    return this.sendResponse(res, HttpStatus.CREATED, data, message);
  }

  sendSuccess(res, data = null, message = 'Operation completed successfully') {
    return this.sendResponse(res, HttpStatus.CREATED, data, message);
  }

  sendPaginated(res, items, pageMeta, message = 'List retrieved successfully', extraData = {}) {
    return res.status(HttpStatus.OK).json({
      success: true,
      statusCode: HttpStatus.OK,
      message,
      ...(extraData || {}),
      data: items,
      meta: {
        totalRecords: pageMeta.totalRecords,
        limit: pageMeta.limit,
        page: pageMeta.page,
        totalPages: pageMeta.totalPages,
        hasNextPage: pageMeta.hasNextPage,
        hasPrevPage: pageMeta.hasPrevPage
      }
    });
  }
  sendSuccess(res, data = null, message = 'Operation completed successfully') {
    return this.sendResponse(res, HttpStatus.OK, data, message);
  }

}
