import { BaseController } from '../../../../common/base.controller.js';

export class SocietyReceiptController extends BaseController {
  constructor(service, fileName) {
    super();
    this.service = service;
    this.fileName = fileName;
    for (const method of ['list', 'create', 'getById', 'update', 'approve', 'reject', 'remove', 'exportCsv', 'getLocations']) {
      this[method] = this[method].bind(this);
    }
  }

  async getLocations(req, res, next) {
    try {
      const result = await this.service.getLocations(req.society);
      return this.sendResponse(res, 200, result, 'Locations dropdown retrieved successfully.');
    } catch (error) { next(error); }
  }


  async list(req, res, next) {
    try {
      const result = await this.service.list(req.society, req.query);
      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Receipts retrieved successfully.',
        data: {
          stats: result.stats,
          items: result.items,
          meta: result.meta
        }
      });
    } catch (error) { next(error); }
  }


  async create(req, res, next) {
    try {
      const file = req.file || (req.files?.file?.[0] || req.files?.image?.[0] || req.files?.receiptImage?.[0] || req.files?.document?.[0]) || null;
      const result = await this.service.create(req.society, req.body, req.user.id, file);
      return this.sendCreated(res, result, 'Receipt created successfully.');
    } catch (error) { next(error); }
  }

  async getById(req, res, next) {
    try {
      const result = await this.service.getById(req.society, req.params.id);
      return this.sendResponse(res, 200, result, 'Receipt retrieved successfully.');
    } catch (error) { next(error); }
  }

  async update(req, res, next) {
    try {
      const file = req.file || (req.files?.file?.[0] || req.files?.image?.[0] || req.files?.receiptImage?.[0] || req.files?.document?.[0]) || null;
      const result = await this.service.update(req.society, req.params.id, req.body, req.user.id, file);
      return this.sendResponse(res, 200, result, 'Receipt updated successfully.');
    } catch (error) { next(error); }
  }

  async approve(req, res, next) {
    try {
      const result = await this.service.approve(req.society, req.params.id, req.user.id);
      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Receipt approved successfully.',
        data: result
      });
    } catch (error) { next(error); }
  }

  async reject(req, res, next) {
    try {
      const result = await this.service.reject(req.society, req.params.id, req.body, req.user.id);
      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Receipt rejected successfully.',
        data: result
      });
    } catch (error) { next(error); }
  }

  async remove(req, res, next) {

    try {
      const result = await this.service.remove(req.society, req.params.id, req.user.id);
      return this.sendResponse(res, 200, result, 'Receipt deleted successfully.');
    } catch (error) { next(error); }
  }

  async exportCsv(req, res, next) {
    try {
      const csv = await this.service.exportCsv(req.society, req.query);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${this.fileName}.csv"`);
      return res.status(200).send(csv);
    } catch (error) { next(error); }
  }
}
