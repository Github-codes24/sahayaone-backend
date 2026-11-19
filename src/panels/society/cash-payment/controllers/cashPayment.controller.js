import { cashPaymentService } from "../services/cashPayment.service.js";

class CashPaymentController {
  async list(req, res, next) {
    try {
      const result = await cashPaymentService.listCashPayments(
        req.society,
        req.query,
      );

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getLocations(req, res, next) {
    try {
      const result = await cashPaymentService.getLocations(req.society);

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: "Available states and cities retrieved successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const result = await cashPaymentService.getCashPaymentDetails(
        req.society,
        req.params.id,
        req.query,
      );

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async submitCash(req, res, next) {
    try {
      const result = await cashPaymentService.submitCash(
        req.params.id,
        req.body,
        req.user?._id,
      );

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const cashPaymentController = new CashPaymentController();
