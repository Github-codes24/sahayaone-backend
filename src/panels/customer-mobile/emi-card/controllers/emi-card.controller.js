import { BaseController } from '../../../../common/base.controller.js';
import { customerEmiCardService } from '../services/emi-card.service.js';

export class CustomerEmiCardController extends BaseController {
  constructor() {
    super();
    this.getCard = this.catchAsync(this.getCard.bind(this));
  }

  async getCard(req, res, next) {
    const customerId = req.user.id;
    const card = await customerEmiCardService.getCardByCustomerId(customerId);
    return this.sendResponse(res, 200, card, 'EMI Card details retrieved successfully.');
  }
}

export const customerEmiCardController = new CustomerEmiCardController();
