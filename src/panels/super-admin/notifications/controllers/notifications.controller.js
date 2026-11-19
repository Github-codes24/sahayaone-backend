import { BaseController } from '../../../../common/base.controller.js';
import { superAdminNotificationsService } from '../services/notifications.service.js';

export class SuperAdminNotificationsController extends BaseController {
  constructor() {
    super();
    this.list = this.catchAsync(this.list.bind(this));
    this.markAsRead = this.catchAsync(this.markAsRead.bind(this));
    this.markAllAsRead = this.catchAsync(this.markAllAsRead.bind(this));
    this.create = this.catchAsync(this.create.bind(this));
  }

  async list(req, res, next) {
    const result = await superAdminNotificationsService.listNotifications(req.query);
    return this.sendPaginated(res, result.items, result.meta, 'Notifications list retrieved successfully.', { unreadCount: result.unreadCount });
  }

  async markAsRead(req, res, next) {
    const userId = req.user?.id || null;
    const result = await superAdminNotificationsService.markAsRead(req.params.id, userId);
    return this.sendResponse(res, 200, result, 'Notification marked as read.');
  }

  async markAllAsRead(req, res, next) {
    const userId = req.user?.id || null;
    const result = await superAdminNotificationsService.markAllAsRead(userId);
    return this.sendResponse(res, 200, result, 'All notifications marked as read.');
  }

  async create(req, res, next) {
    const creatorId = req.user?.id || null;
    const result = await superAdminNotificationsService.createNotification(req.body, creatorId);
    return this.sendCreated(res, result, 'Notification created successfully.');
  }
}

export const superAdminNotificationsController = new SuperAdminNotificationsController();
