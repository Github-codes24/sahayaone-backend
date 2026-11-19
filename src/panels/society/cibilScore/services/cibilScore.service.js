import { CreditReportRequest } from "../../../../models/cibilReport.model.js";
import { ApiError } from "../../../../common/api.error.js";
import { experianService } from "./experian.service.js";
import { creditSearchStylePdfService } from "./cibilPdf.service.js";
import { storageManager } from "../../../../storage/storage.manager.js";
import { logger } from "../../../../utils/logger.util.js";

export class CreditReportService {
    async generate(data) {
        logger.info(`[CreditReportService] Starting credit report generation for PAN: ${data.pan}, Mobile: ${data.mobileNumber}`);
        // Check if report exists in database and is still valid (not older than 30 days)
        const validityDays = 30;
        const expiryDate = new Date(Date.now() - validityDays * 24 * 60 * 60 * 1000);

        const existingReport = await CreditReportRequest.findOne({
            pan: data.pan.toUpperCase(),
            status: 'completed',
            createdAt: { $gte: expiryDate },
            ...(data.societyId ? { societyId: data.societyId } : {}),
        }).select('+reportJson').sort({ createdAt: -1 });

        if (existingReport && existingReport.reportJson) {
            logger.info(`[CreditReportService] Found valid cached report. Request ID: ${existingReport.requestId}, Created At: ${existingReport.createdAt}`);
            let pdfUrl = existingReport.pdfUrl;

            // If cached report doesn't have a pdfUrl yet, generate and upload it on demand
            if (!pdfUrl) {
                try {
                    logger.info(`[CreditReportService] Cached report doesn't have PDF. Generating PDF on demand...`);
                    const pdfBuffer = await creditSearchStylePdfService.generatePdf({
                        requestDetails: {
                            requestId: existingReport.requestId,
                            fullName: existingReport.fullName,
                            dob: existingReport.dob,
                            pan: existingReport.pan,
                            mobile: existingReport.mobileNumber,
                            createdAt: existingReport.createdAt,
                            memberName: data.memberName || null,
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
                    logger.info(`[CreditReportService] PDF generated and uploaded successfully for cached report.`);
                } catch (pdfErr) {
                    logger.error(`PDF generation error for cached report ${existingReport.requestId}: ${pdfErr.message}`, pdfErr);
                }
            }

            return {
                requestId: existingReport.requestId,
                status: existingReport.status,
                message: 'Credit report retrieved from cache.',
                pdfUrl: pdfUrl || null,
                reportJson: existingReport.reportJson,
            };
        }


        logger.info(`[CreditReportService] No valid cached report found. Creating a new request record...`);
        const request = await CreditReportRequest.create({
            fullName: data.fullName,
            dob: data.dob,
            pan: data.pan,
            mobileNumber: data.mobileNumber,
            societyId: data.societyId ?? null,
            requestedBy: data.requestedBy ?? null,
            status: "processing",
        });
        logger.info(`[CreditReportService] Created new request record with ID: ${request.requestId}`);

        try {
            logger.info(`[CreditReportService] Fetching credit report from Experian Service for ReqID: ${request.requestId}`);
            const reportResponse = await experianService.fetchCreditReport({
                mobile: data.mobileNumber,
                pan: data.pan,
                name: data.fullName,
                dob: data.dob,
                reqId: request.requestId,
            });
            logger.info(`[CreditReportService] Successfully fetched credit report from Experian Service for ReqID: ${request.requestId}`);

            request.status = "completed";
            request.reportJson = reportResponse;

            // Generate PDF from bureau response & upload to Cloudinary/Storage
            let pdfUrl = null;
            try {
                logger.info(`[CreditReportService] Generating PDF for new report ReqID: ${request.requestId}`);
                const pdfBuffer = await creditSearchStylePdfService.generatePdf({
                    requestDetails: {
                        requestId: request.requestId,
                        fullName: data.fullName,
                        dob: data.dob,
                        pan: data.pan,
                        mobile: data.mobileNumber,
                        createdAt: request.createdAt || new Date(),
                        memberName: data.memberName || null,
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
                logger.info(`[CreditReportService] PDF generated and uploaded successfully for ReqID: ${request.requestId}`);

            } catch (pdfErr) {
                logger.error(`PDF generation/upload failed for CIBIL request ${request.requestId}: ${pdfErr.message}`, pdfErr);
            }

            await request.save();

            return {
                requestId: request.requestId,
                status: request.status,
                message: 'Credit report fetched successfully.',
                pdfUrl: pdfUrl || null,
                reportJson: reportResponse
            };

        } catch (error) {
            logger.error(`[CreditReportService] Experian API fetch failed for ReqID: ${request.requestId}. Error: ${error.message}`, {
                message: error.message,
                status: error.statusCode || error.status || null,
                details: error.details || null,
                stack: error.stack
            });
            request.status = "failed";
            request.reportJson = {
                error: error.message,
                details: error.details || null,
                timeStamp: new Date(),
            };
            await request.save();
            throw error;
        }

    }

    async getHistory({ societyId, query = {} }) {
        const page = Math.max(1, parseInt(query.page || 1, 10));
        const limit = Math.min(100, Math.max(1, parseInt(query.limit || 10, 10)));
        const skip = (page - 1) * limit;

        const filter = {};
        if (societyId) {
            filter.societyId = societyId;
        }

        if (query.status) {
            filter.status = query.status;
        }

        if (query.search && query.search.trim()) {
            const searchRegex = new RegExp(query.search.trim(), 'i');
            filter.$or = [
                { pan: searchRegex },
                { fullName: searchRegex },
                { mobileNumber: searchRegex },
                { requestId: searchRegex },
            ];
        }

        if (query.startDate || query.endDate) {
            filter.createdAt = {};
            if (query.startDate) {
                filter.createdAt.$gte = new Date(query.startDate);
            }
            if (query.endDate) {
                filter.createdAt.$lte = new Date(query.endDate);
            }
        }

        logger.info(`[CreditReportService] Fetching history list. Filter: ${JSON.stringify(filter)}, page: ${page}, limit: ${limit}`);

        const [items, total] = await Promise.all([
            CreditReportRequest.find(filter)
                .populate('requestedBy', 'fullName email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            CreditReportRequest.countDocuments(filter),
        ]);

        return {
            items,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1,
            },
        };
    }

    async getById({ societyId, id, memberName = null }) {
        logger.info(`[CreditReportService] Fetching report details for ID: ${id}, societyId: ${societyId}`);

        const isObjectId = typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/);
        const query = {
            ...(societyId ? { societyId } : {}),
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

        // On-demand PDF generation if report is completed but pdfUrl is missing
        if (report.status === 'completed' && !report.pdfUrl && report.reportJson) {
            try {
                logger.info(`[CreditReportService] Report ${report.requestId} has no PDF. Generating on-demand...`);
                const pdfBuffer = await creditSearchStylePdfService.generatePdf({
                    requestDetails: {
                        requestId: report.requestId,
                        fullName: report.fullName,
                        dob: report.dob,
                        pan: report.pan,
                        mobile: report.mobileNumber,
                        createdAt: report.createdAt,
                        memberName: memberName || null,
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
                logger.info(`[CreditReportService] On-demand PDF generated successfully for report ${report.requestId}`);
            } catch (pdfErr) {
                logger.error(`PDF generation error for report ${report.requestId}: ${pdfErr.message}`, pdfErr);
            }
        }

        return report;
    }
}

export const creditReportService = new CreditReportService();