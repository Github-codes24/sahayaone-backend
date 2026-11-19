import { CreditReportRequest } from '../../../../models/cibilReport.model.js';
import { MerchantProfile } from '../../../../models/merchant-profile.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { CreditLog } from '../../../../models/credit-log.model.js';
import { CardCreditUsage } from '../../../../models/card-credit-usage.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { experianService } from '../../../society/cibilScore/services/experian.service.js';
import { creditSearchStylePdfService } from '../../../society/cibilScore/services/cibilPdf.service.js';
import { storageManager } from '../../../../storage/storage.manager.js';
import { logger } from '../../../../utils/logger.util.js';

export class MerchantCibilScoreService {
    async getMerchantContext(merchantUser) {
        const userId = merchantUser?.id || merchantUser?._id || merchantUser?.userId;
        let merchant = null;
        if (merchantUser?.merchantId) {
            merchant = await MerchantProfile.findById(merchantUser.merchantId);
        }
        if (!merchant && userId) {
            merchant = await MerchantProfile.findOne({ userId, isDeleted: { $ne: true } });
        }
        const bankId = merchant?.bankId || merchantUser?.bankId || null;
        const branchId = merchant?.branchId || merchantUser?.branchId || null;

        let branch = null;
        if (branchId) {
            branch = await Branch.findById(branchId);
        }

        return { userId, merchant, bankId, branchId, branch };
    }

    async generate(data, merchantUser) {
        const { userId, merchant, bankId, branchId, branch } = await this.getMerchantContext(merchantUser);

        if (!userId) {
            throw ApiError.unauthorized('Merchant user identity missing.');
        }

        const cleanPan = data.pan.toUpperCase();
        logger.info(`[MerchantCibilScoreService] Starting CIBIL score check for PAN: ${cleanPan}, Merchant: ${merchant?.shopName || userId}`);

        const validityDays = 30;
        const expiryDate = new Date(Date.now() - validityDays * 24 * 60 * 60 * 1000);

        // 30-Day Cache Check Rule
        const existingReport = await CreditReportRequest.findOne({
            pan: cleanPan,
            status: 'completed',
            createdAt: { $gte: expiryDate },
            ...(bankId ? { societyId: bankId } : {})
        }).select('+reportJson').sort({ createdAt: -1 });

        if (existingReport && existingReport.reportJson) {
            logger.info(`[MerchantCibilScoreService] Found valid cached report for PAN: ${cleanPan}`);
            let pdfUrl = existingReport.pdfUrl;

            if (!pdfUrl) {
                try {
                    const pdfBuffer = await creditSearchStylePdfService.generatePdf({
                        requestDetails: {
                            requestId: existingReport.requestId,
                            fullName: existingReport.fullName,
                            dob: existingReport.dob,
                            pan: existingReport.pan,
                            mobile: existingReport.mobileNumber,
                            createdAt: existingReport.createdAt,
                            memberName: merchant?.shopName || 'Merchant'
                        },
                        creditReport: existingReport.reportJson.data || existingReport.reportJson
                    });

                    const uploadResult = await storageManager.uploadFile({
                        buffer: pdfBuffer,
                        originalname: `cibil-report-${existingReport.requestId}.pdf`,
                        mimetype: 'application/pdf',
                        size: pdfBuffer.length
                    }, 'cibil-reports');

                    pdfUrl = uploadResult.fileUrl;
                    await CreditReportRequest.updateOne(
                        { _id: existingReport._id },
                        { $set: { pdfUrl: uploadResult.fileUrl, pdfPublicId: uploadResult.filePath } }
                    );
                } catch (pdfErr) {
                    logger.error(`PDF generation error for cached CIBIL report ${existingReport.requestId}: ${pdfErr.message}`);
                }
            }

            return {
                requestId: existingReport.requestId,
                status: existingReport.status,
                message: 'Credit report retrieved from cache.',
                pdfUrl: pdfUrl || null,
                reportJson: existingReport.reportJson,
                cached: true
            };
        }

        // Branch Verification Credit Check
        if (branch) {
            const availCredits = branch.availableVerificationCredits ?? branch.verificationCredits ?? 0;
            if (availCredits <= 0) {
                throw ApiError.badRequest('No verification credits available in branch stock. Please request credits from associated Bank/Society.');
            }
        }

        const request = await CreditReportRequest.create({
            fullName: data.fullName,
            dob: data.dob,
            pan: cleanPan,
            mobileNumber: data.mobileNumber,
            societyId: bankId ?? null,
            requestedBy: userId ?? null,
            status: 'processing'
        });

        try {
            const reportResponse = await experianService.fetchCreditReport({
                mobile: data.mobileNumber,
                pan: cleanPan,
                name: data.fullName,
                dob: data.dob,
                reqId: request.requestId
            });

            request.status = 'completed';
            request.reportJson = reportResponse;

            let pdfUrl = null;
            try {
                const pdfBuffer = await creditSearchStylePdfService.generatePdf({
                    requestDetails: {
                        requestId: request.requestId,
                        fullName: data.fullName,
                        dob: data.dob,
                        pan: cleanPan,
                        mobile: data.mobileNumber,
                        createdAt: request.createdAt || new Date(),
                        memberName: merchant?.shopName || 'Merchant'
                    },
                    creditReport: reportResponse.data || reportResponse
                });

                const uploadResult = await storageManager.uploadFile({
                    buffer: pdfBuffer,
                    originalname: `cibil-report-${request.requestId}.pdf`,
                    mimetype: 'application/pdf',
                    size: pdfBuffer.length
                }, 'cibil-reports');

                pdfUrl = uploadResult.fileUrl;
                request.pdfUrl = uploadResult.fileUrl;
                request.pdfPublicId = uploadResult.filePath;
            } catch (pdfErr) {
                logger.error(`PDF generation failed for new CIBIL request ${request.requestId}: ${pdfErr.message}`);
            }

            await request.save();

            // Deduct 1 credit from Branch upon fresh CIBIL score check
            if (branch) {
                const balanceBefore = branch.availableVerificationCredits ?? branch.verificationCredits ?? 0;
                branch.verificationCredits = Math.max(0, (branch.verificationCredits || 0) - 1);
                branch.availableVerificationCredits = Math.max(0, balanceBefore - 1);
                await branch.save();

                await CreditLog.create({
                    bankId: branch.bankId,
                    branchId: branch._id,
                    type: 'VERIFICATION_CREDIT',
                    action: 'DEDUCTION',
                    amount: 1,
                    merchantId: merchant?._id || null,
                    description: `Verification credit deducted for merchant (${merchant?.shopName || 'Merchant'}) CIBIL score check: ${data.fullName}`
                });

                await CardCreditUsage.create({
                    bankId: branch.bankId,
                    branchId: branch._id,
                    type: 'VERIFICATION_CREDIT',
                    quantity: 1,
                    balanceBefore,
                    balanceAfter: branch.availableVerificationCredits,
                    createdBy: userId
                });
            }

            return {
                requestId: request.requestId,
                status: request.status,
                message: 'Credit report fetched successfully.',
                pdfUrl: pdfUrl || null,
                reportJson: reportResponse,
                creditDeducted: branch ? 1 : 0
            };
        } catch (error) {
            request.status = 'failed';
            request.reportJson = {
                error: error.message,
                details: error.details || null,
                timeStamp: new Date()
            };
            await request.save();
            throw error;
        }
    }

    async getHistory(merchantUser, query = {}) {
        const { userId, bankId } = await this.getMerchantContext(merchantUser);

        const page = Math.max(1, parseInt(query.page || 1, 10));
        const limit = Math.min(100, Math.max(1, parseInt(query.limit || 10, 10)));
        const skip = (page - 1) * limit;

        const filter = {
            $or: [
                { requestedBy: userId },
                ...(bankId ? [{ societyId: bankId }] : [])
            ]
        };

        if (query.status) {
            filter.status = query.status;
        }

        if (query.search && query.search.trim()) {
            const searchRegex = new RegExp(query.search.trim(), 'i');
            filter.$and = [
                {
                    $or: [
                        { pan: searchRegex },
                        { fullName: searchRegex },
                        { mobileNumber: searchRegex },
                        { requestId: searchRegex }
                    ]
                }
            ];
        }

        const [items, total] = await Promise.all([
            CreditReportRequest.find(filter)
                .populate('requestedBy', 'fullName email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            CreditReportRequest.countDocuments(filter)
        ]);

        return {
            items,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1
            }
        };
    }

    async getById(merchantUser, id) {
        const { userId, bankId, merchant } = await this.getMerchantContext(merchantUser);

        const isObjectId = typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/);
        const query = {
            $or: [
                ...(isObjectId ? [{ _id: id }] : []),
                { requestId: id }
            ]
        };

        const report = await CreditReportRequest.findOne(query)
            .select('+reportJson')
            .populate('requestedBy', 'fullName email');

        if (!report) {
            throw ApiError.notFound('Credit report record not found or access denied.');
        }

        if (report.status === 'completed' && !report.pdfUrl && report.reportJson) {
            try {
                const pdfBuffer = await creditSearchStylePdfService.generatePdf({
                    requestDetails: {
                        requestId: report.requestId,
                        fullName: report.fullName,
                        dob: report.dob,
                        pan: report.pan,
                        mobile: report.mobileNumber,
                        createdAt: report.createdAt,
                        memberName: merchant?.shopName || null
                    },
                    creditReport: report.reportJson.data || report.reportJson
                });

                const uploadResult = await storageManager.uploadFile({
                    buffer: pdfBuffer,
                    originalname: `cibil-report-${report.requestId}.pdf`,
                    mimetype: 'application/pdf',
                    size: pdfBuffer.length
                }, 'cibil-reports');

                report.pdfUrl = uploadResult.fileUrl;
                report.pdfPublicId = uploadResult.filePath;
                await report.save();
            } catch (pdfErr) {
                logger.error(`PDF generation error for CIBIL report ${report.requestId}: ${pdfErr.message}`);
            }
        }

        return report;
    }
}

export const merchantCibilScoreService = new MerchantCibilScoreService();
