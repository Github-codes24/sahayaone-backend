import { Router } from 'express';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { uploadReceiptDocument } from '../../../../middlewares/upload.middleware.js';
import { resolveSocietyContext } from '../../middlewares/society-context.middleware.js';
import { requireSocietyPermission } from '../../middlewares/society-permission.middleware.js';
import {
  createReceiptSchema,
  updateReceiptSchema,
  receiptListSchema,
  receiptIdSchema,
  rejectReceiptSchema
} from './receipt.validator.js';

export const createReceiptRouter = (controller) => {
  const router = Router();
  router.use(rbacMiddleware.requireAuth, resolveSocietyContext);
  router.get('/export', requireSocietyPermission('receipt.view'), validateRequest(receiptListSchema), controller.exportCsv);
  router.get('/locations', requireSocietyPermission('receipt.view'), controller.getLocations);
  router.get('/', requireSocietyPermission('receipt.view'), validateRequest(receiptListSchema), controller.list);
  router.post('/', requireSocietyPermission('receipt.create'), uploadReceiptDocument, validateRequest(createReceiptSchema), controller.create);
  router.get('/:id', requireSocietyPermission('receipt.view'), validateRequest(receiptIdSchema), controller.getById);

  router.put('/:id/approve', requireSocietyPermission('receipt.update'), validateRequest(receiptIdSchema), controller.approve);
  router.patch('/:id/approve', requireSocietyPermission('receipt.update'), validateRequest(receiptIdSchema), controller.approve);

  router.put('/:id/reject', requireSocietyPermission('receipt.update'), validateRequest(rejectReceiptSchema), controller.reject);
  router.patch('/:id/reject', requireSocietyPermission('receipt.update'), validateRequest(rejectReceiptSchema), controller.reject);
  router.post('/:id/reject', requireSocietyPermission('receipt.update'), validateRequest(rejectReceiptSchema), controller.reject);

  router.put('/:id', requireSocietyPermission('receipt.update'), uploadReceiptDocument, validateRequest({ ...receiptIdSchema, ...updateReceiptSchema }), controller.update);
  router.delete('/:id', requireSocietyPermission('receipt.delete'), validateRequest(receiptIdSchema), controller.remove);
  return router;
};

