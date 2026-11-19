import { Router } from 'express';
import { customerEmiCardController } from '../controllers/emi-card.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';

const router = Router();

// Apply auth middleware to protect the EMI card endpoint
router.use(rbacMiddleware.requireAuth);

router.get('/', customerEmiCardController.getCard);

export default router;
