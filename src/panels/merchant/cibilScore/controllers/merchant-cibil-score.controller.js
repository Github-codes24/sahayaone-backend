import { BaseController } from '../../../../common/base.controller.js';
import { merchantCibilScoreService } from '../services/merchant-cibil-score.service.js';

export class MerchantCibilScoreController extends BaseController {
    constructor() {
        super();
        this.checkCreditScore = this.catchAsync(this.checkCreditScore.bind(this));
        this.getHistory = this.catchAsync(this.getHistory.bind(this));
        this.getById = this.catchAsync(this.getById.bind(this));
    }

    /**
     * POST /api/v1/merchant/cibil-score
     */
    async checkCreditScore(req, res) {
        const result = await merchantCibilScoreService.generate(req.body, req.user);
        return this.sendResponse(res, 200, result, 'Credit report fetched successfully.');
    }

    /**
     * GET /api/v1/merchant/cibil-score
     */
    async getHistory(req, res) {
        const result = await merchantCibilScoreService.getHistory(req.user, req.query);
        return this.sendResponse(res, 200, result, 'CIBIL report history retrieved successfully.');
    }

    /**
     * GET /api/v1/merchant/cibil-score/:id
     */
    async getById(req, res) {
        const result = await merchantCibilScoreService.getById(req.user, req.params.id);
        return this.sendResponse(res, 200, result, 'Credit report retrieved successfully.');
    }
}

export const merchantCibilScoreController = new MerchantCibilScoreController();
