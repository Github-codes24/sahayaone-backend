import { Router } from 'express';
import { customerPigmyController } from '../controllers/pigmy.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';

const router = Router();

// Require customer authentication
router.use(rbacMiddleware.requireAuth);

// List accounts (both / and /accounts supported)
router.get('/', customerPigmyController.listAccounts);
router.get('/accounts', customerPigmyController.listAccounts);

// Account details (both /:id and /accounts/:id supported)
router.get('/accounts/:id', customerPigmyController.getAccountDetails);
router.get('/:id', customerPigmyController.getAccountDetails);

export default router;
