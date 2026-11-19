import { EmiCard } from '../../../../models/emi-card.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';

export class CustomerEmiCardService {
  /**
   * Retrieves the EMI Card details for the logged-in customer user
   * @param {String} customerId - The customer's User document ID
   */
  async getCardByCustomerId(customerId) {
    const card = await EmiCard.findOne({ customerId })
      .populate('bankId', 'name code')
      .populate('branchId', 'name code');

    if (!card) {
      throw ApiError.notFound('No EMI card is currently allotted to your account.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    return card;
  }
}

export const customerEmiCardService = new CustomerEmiCardService();
