import { BaseController } from "../../../../common/base.controller.js";
import { creditReportService } from "../services/cibilScore.service.js"
import { logger } from "../../../../utils/logger.util.js";

export class CreditReportController extends BaseController {
    constructor() {
        super();
        this.checkCreditScore = this.catchAsync(this.checkCreditScore.bind(this));
        this.getHistory = this.catchAsync(this.getHistory.bind(this));
        this.getById = this.catchAsync(this.getById.bind(this));
    }

    async checkCreditScore(req, res) {
        logger.info(`[CreditReportController] Request received to check credit score. Body: ${JSON.stringify(req.body)}`);
        try {
            const result = await creditReportService.generate({
                ...req.body,
                requestedBy: req.user?.id,
                societyId: req.society?.bankId ?? null,
                memberName: req.society?.bank?.name ?? null,
            });
            logger.info(`[CreditReportController] Request processed successfully.`);
            return this.sendResponse(res, 200, result, 'Credit report fetched successfully.');
        } catch (error) {
            logger.error(`[CreditReportController] Error processing check credit score: ${error.message}`, { stack: error.stack });
            throw error;
        }
    }

    async getHistory(req, res) {
        logger.info(`[CreditReportController] Request received to fetch history. Query: ${JSON.stringify(req.query)}`);
        const result = await creditReportService.getHistory({
            societyId: req.society?.bankId ?? null,
            query: req.query,
        });
        return this.sendResponse(res, 200, result, 'CIBIL report history retrieved successfully.');
    }

    async getById(req, res) {
        logger.info(`[CreditReportController] Request received to fetch report by ID: ${req.params.id}`);
        const result = await creditReportService.getById({
            societyId: req.society?.bankId ?? null,
            id: req.params.id,
            memberName: req.society?.bank?.name ?? null,
        });
        return this.sendResponse(res, 200, result, 'Credit report retrieved successfully.');
    }
}

export const creditReportController = new CreditReportController();