import { Router } from 'express';
import { superAdminNotificationsController } from '../controllers/notifications.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import {
  listNotificationsSchema,
  markAsReadSchema,
  createNotificationSchema
} from '../validators/notifications.validator.js';

const router = Router();

// Authentication and role authorization middleware
router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['SUPER_ADMIN', 'SUB_ADMIN', 'HO_ADMIN', 'EMPLOYEE']));

// List notifications (with type, isRead filter, unread count, and pagination)
router.get(
  '/',
  rbacMiddleware.requirePermission('notification:view_only'),
  validateRequest(listNotificationsSchema),
  superAdminNotificationsController.list
);

// Mark all notifications as read
router.put(
  '/read-all',
  rbacMiddleware.requirePermission('notification:edit'),
  superAdminNotificationsController.markAllAsRead
);

router.post(
  '/read-all',
  rbacMiddleware.requirePermission('notification:edit'),
  superAdminNotificationsController.markAllAsRead
);

// Mark single notification as read
router.put(
  '/:id/read',
  rbacMiddleware.requirePermission('notification:edit'),
  validateRequest(markAsReadSchema),
  superAdminNotificationsController.markAsRead
);

// Create new notification
router.post(
  '/',
  rbacMiddleware.requirePermission('notification:create'),
  validateRequest(createNotificationSchema),
  superAdminNotificationsController.create
);

export default router;
