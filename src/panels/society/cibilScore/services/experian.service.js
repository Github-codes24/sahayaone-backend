import jwt from "jsonwebtoken";
import axios from "axios";
import { ApiError } from "../../../../common/api.error.js";
import { logger } from "../../../../utils/logger.util.js";


export class ExperianService {

    formatDob(dobInput) {
        if (!dobInput) return null;
        if (dobInput instanceof Date) {
            if (isNaN(dobInput.getTime())) return null;
            const yyyy = dobInput.getFullYear();
            const mm = String(dobInput.getMonth() + 1).padStart(2, '0');
            const dd = String(dobInput.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        }
        const str = String(dobInput).trim();
        if (!str) return null;
        if (str.includes('T')) {
            const part = str.split('T')[0];
            if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
        }
        if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(str)) {
            const parts = str.split(/[-/]/);
            const yyyy = parts[0];
            const mm = parts[1].padStart(2, '0');
            const dd = parts[2].padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        }
        if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(str)) {
            const parts = str.split(/[-/]/);
            const dd = parts[0].padStart(2, '0');
            const mm = parts[1].padStart(2, '0');
            const yyyy = parts[2];
            return `${yyyy}-${mm}-${dd}`;
        }
        return str;
    }

    async fetchCreditReport({ mobile, pan, name, dob, reqId }) {

        const isProd = true;

        const url = isProd ? (process.env.EXPERIAN_PROD_URL) : (process.env.EXPERIAN_UAT_URL);

        const authorisedKey = isProd ? (process.env.EXPERIAN_AUTH_KEY) : (process.env.EXPERIAN_UAT_AUTH_KEY);

        const userAgent = isProd ? (process.env.EXPERIAN_USER_AGENT) : (process.env.EXPERIAN_UAT_USER_AGENT);

        const partnerId = isProd ? (process.env.EXPERIAN_PARTNER_ID) : (process.env.EXPERIAN_UAT_PARTNER_ID);

        const jwtSecret = isProd ? (process.env.EXPERIAN_JWT_SECRET) : (process.env.EXPERIAN_UAT_JWT_SECRET);

        logger.info(`[ExperianService] fetchCreditReport starting. URL: ${url}, isProd: ${isProd}`);

        const payLoad = {
            timestamp: Math.floor(Date.now() / 1000),
            partnerId: partnerId,
            reqid: reqId,
        }

        if (!jwtSecret) {
            throw new ApiError("Experian JWT Secret configuration is missing", 500, "CONFIG_ERROR");
        }

        if (!partnerId) {
            throw new ApiError("Experian Partner ID (Corp ID) configuration is missing", 500, "CONFIG_ERROR");
        }

        const token = jwt.sign(payLoad, jwtSecret, {
            algorithm: "HS256",
            noTimestamp: true,
        });

        // Production auth: JWT token + User-Agent (Corp ID) only.
        // UAT auth: additionally requires Authorisedkey header.
        const headers = {
            'Token': token,
            'User-Agent': userAgent,
            'Content-Type': 'application/json',
            ...(authorisedKey ? { 'Authorisedkey': authorisedKey } : {}),
        };

        const formattedDob = this.formatDob(dob);

        const requestBody = {
            mobile,
            pan,
            name,
            ...(formattedDob ? { dob: formattedDob } : {})
        };

        logger.info(`[ExperianService] Headers: ${JSON.stringify({ ...headers, Token: headers.Token ? '[MASKED]' : null })}`);
        logger.info(`[ExperianService] Request Body: ${JSON.stringify(requestBody)}`);

        try {
            logger.info(`[ExperianService] Making POST request to: ${url}`);
            const response = await axios.post(url, requestBody, { headers });
            const responseData = response.data;
            logger.info(`[ExperianService] Response Data received [ORIGINAL]: status=${response.status}, data=${JSON.stringify(responseData)}`);
            logger.info(`[ExperianService] Response Data received: ${JSON.stringify(responseData)}`);

            if (responseData.statuscode === 200 && responseData.status === true) {
                logger.info(`[ExperianService] Success response: ${JSON.stringify(responseData)}`);
                return responseData;
            } else if (responseData.statuscode === 422) {
                logger.warn(`[ExperianService] Unprocessable entity (422) response: ${JSON.stringify(responseData)}`);
                // Request processed successfully but bureau data unavailable (Billable)
                throw ApiError.unprocessable(
                    responseData.message || 'Credit bureau data unavailable for this user.',
                    'BUREAU_DATA_UNAVAILABLE',
                    responseData
                );
            } else {
                logger.error(`[ExperianService] Bad request / API error response: ${JSON.stringify(responseData)}`);
                // Other validation errors, expired JWT, etc. (Non-Billable)
                throw ApiError.badRequest(
                    responseData.message || 'Failed to fetch credit report.',
                    'EXPERIAN_API_ERROR',
                    responseData
                );
            }

        } catch (error) {
            if (error instanceof ApiError) throw error;
            const message = error.response?.data?.message || error.message || 'Experian API communication error';
            const status = error.response?.status || 500;
            const details = error.response?.data || null;

            logger.error(`[ExperianService] Connection/HTTP error. Target URL: ${url}, Request Body: ${JSON.stringify(requestBody)}, Headers: ${JSON.stringify({ ...headers, Token: '[MASKED]' })}, Status: ${status}, Message: ${message}, Details: ${JSON.stringify(details)}`);
            throw new ApiError(message, status, 'EXPERIAN_CONNECTION_ERROR', details);
        }
    }
}

export const experianService = new ExperianService();