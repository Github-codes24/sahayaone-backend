import { Router } from 'express';
import { customerBankAccountController } from '../controllers/bank-account.controller.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { createBankAccountSchema, updateBankAccountSchema } from '../validators/bank-account.validator.js';

const router = Router();

// Apply auth middleware to protect all bank account routes
router.use(rbacMiddleware.requireAuth);

router.get('/', customerBankAccountController.list);
router.post('/', validateRequest(createBankAccountSchema), customerBankAccountController.create);
router.put('/:id', validateRequest(updateBankAccountSchema), customerBankAccountController.update);
router.delete('/:id', customerBankAccountController.delete);
router.put('/:id/primary', customerBankAccountController.setPrimary);

export default router;
