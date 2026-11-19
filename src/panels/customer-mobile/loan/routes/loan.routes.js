import { Router } from 'express';
import { customerLoanController } from '../controllers/loan.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';

const router = Router();

// Apply auth middleware to protect all loan endpoints
router.use(rbacMiddleware.requireAuth);

router.get('/', customerLoanController.list);
router.get('/:id', customerLoanController.getDetails);
router.post('/:id/pay-emi', customerLoanController.payEmi);
router.get('/:id/noc', customerLoanController.downloadNoc);

export default router;
