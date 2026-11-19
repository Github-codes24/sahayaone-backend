import axios from "axios";
import FormData from "form-data";
import { generateDigiLockerJwt } from "./digilocker-jwt.util.js";
import { ApiError } from "../../../../common/api.error.js";
import { HttpStatus } from "../../../../constants/http-status.constant.js";
import { ErrorCode } from "../../../../constants/error-code.constant.js";
import { logger } from "../../../../utils/logger.util.js";
import { decodeBase64Xml } from "./xml-parser.util.js";

/**
 * Base URLs — Spec Section 3.1 (UAT Base URL) & 3.2 (Production Base URL)
 * UAT:
 * Production:
 */
const getBaseUrl = () => {
  const isProd = true;
  return isProd
    ? process.env.DIGILOCKER_PROD_URL || process.env.DIGILOCKER_UAT_URL
    : process.env.DIGILOCKER_UAT_URL || process.env.DIGILOCKER_PROD_URL;
};

const getCredentials = () => {
  const isProd = true;
  const partnerId = isProd
    ? process.env.DIGILOCKER_PROD_PARTNER_ID ||
      process.env.DIGILOCKER_PARTNER_ID
    : process.env.DIGILOCKER_UAT_PARTNER_ID ||
      process.env.DIGILOCKER_PARTNER_ID;
  const authorisedKey = isProd
    ? process.env.DIGILOCKER_PROD_AUTH_KEY ||
      process.env.DIGILOCKER_AUTHORISED_KEY
    : process.env.DIGILOCKER_UAT_AUTH_KEY ||
      process.env.DIGILOCKER_AUTHORISED_KEY;

  return { partnerId, authorisedKey };
};

/**
 * Required Headers — Spec Section 2.4 & 3.3:
 *   Token          -> fresh JWT Token (HS256, 5 min validity, generated before every request)
 *   User-Agent     -> Partner CORP ID (CORP00001)
 *   Authorisedkey  -> optional API auth key if configured
 */
const getCommonHeaders = (refid = null) => {
  const { partnerId, authorisedKey } = getCredentials();
  const token = generateDigiLockerJwt(refid);

  return {
    Token: token,
    "User-Agent": partnerId,
    ...(authorisedKey ? { Authorisedkey: authorisedKey } : {}),
  };
};

const toNumber = (value) =>
  value === undefined || value === null || value === "" ? null : Number(value);

/**
 * Normalizes SprintVerify DigiLocker API responses.
 * Status codes per Spec Section 8 (Billing Information):
 *   200 -> Request processed successfully (Billable: Yes)
 *   422 -> Processed but document unavailable (Billable: Yes)
 *   201 -> Validation Error (Billable: No)
 */
const normalizeResponse = (data) => {
  const statuscode = toNumber(
    data?.statuscode ?? data?.statusCode ?? data?.status_code,
  );
  const statusFlag =
    data?.status === true || String(data?.status).toUpperCase() === "SUCCESS";
  const success =
    statuscode === 200 || (statuscode === null && statusFlag === true);

  return {
    success,
    statuscode,
    message: data?.message || data?.Message || data?.msg || "",
    data: data?.data !== undefined ? data.data : data,
    raw: data,
  };
};

/**
 * Executes a DigiLocker HTTP request strictly per spec (Sections 2.4, 3.3, 10):
 *   - Uses multipart/form-data encoding
 *   - Only documented fields sent per endpoint
 *   - Generates fresh JWT Token for every request
 *   - Adds detailed console and logger logging for every request and response
 */
const executeDigiLockerRequest = async (endpoint, params = {}) => {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  const headers = getCommonHeaders(params.refid);

  console.log("\n--- [DigiLocker Client] executeDigiLockerRequest Started ---");
  console.log(`[DigiLocker Client] Resolved API URL: ${url}`);
  console.log(
    `[DigiLocker Client] Request Params:`,
    JSON.stringify(params, null, 2),
  );

  const requestHeaders = {
    ...headers,
    "Content-Type": "application/json",
  };

  console.log(
    "================================================================",
  );
  console.log(`[DigiLocker Client API Request] POST ${url}`);
  console.log(
    "[DigiLocker Client Request Headers]:",
    JSON.stringify(
      {
        ...requestHeaders,
        Token: requestHeaders.Token
          ? `${requestHeaders.Token.slice(0, 25)}... [Full Token: ${requestHeaders.Token}]`
          : null,
      },
      null,
      2,
    ),
  );
  console.log(
    "[DigiLocker Client Request JSON Params]:",
    JSON.stringify(params, null, 2),
  );
  console.log(
    "================================================================",
  );

  logger.info(`[DigiLocker] Sending request [${endpoint}]`, {
    url,
    fields: Object.keys(params),
  });

  try {
    console.log(
      `[DigiLocker Client] Initiating POST request (application/json) to ${url}...`,
    );
    const response = await axios.post(url, params, {
      headers: requestHeaders,
      timeout: 20000,
    });

    console.log(
      "\n----------------------------------------------------------------",
    );
    console.log(
      `[DigiLocker Client API Response] HTTP Status: ${response.status} ${response.statusText}`,
    );
    console.log(
      "[DigiLocker Client Response Headers]:",
      JSON.stringify(response.headers, null, 2),
    );
    console.log(
      "[DigiLocker Client Response Data]:",
      JSON.stringify(response.data, null, 2),
    );
    console.log(
      "----------------------------------------------------------------\n",
    );

    const normalized = normalizeResponse(response.data);
    logger.info(`[DigiLocker] Response [${endpoint}]`, {
      success: normalized.success,
      statuscode: normalized.statuscode,
      message: normalized.message,
    });
    return normalized;
  } catch (error) {
    console.error(
      "\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
    );
    console.error(
      `[DigiLocker Client API Error] POST ${endpoint} failed:`,
      error.message,
    );

    console.error(
      "[DigiLocker Client Request Details Sent]:",
      JSON.stringify(
        {
          url,
          headers: requestHeaders,
        },
        null,
        2,
      ),
    );

    if (error.response) {
      console.error(
        `[DigiLocker Client Response Status]: ${error.response.status}`,
      );
      console.error(
        "[DigiLocker Client Response Headers]:",
        JSON.stringify(error.response.headers, null, 2),
      );
      console.error(
        "[DigiLocker Client Response Body]:",
        JSON.stringify(error.response.data, null, 2),
      );
    } else if (error.request) {
      console.error(
        "[DigiLocker Client Request Error] No response received from server.",
      );
    } else {
      console.error("[DigiLocker Client Local Error]:", error.stack);
    }
    console.error(
      "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n",
    );

    logger.error(`[DigiLocker] API Error [${endpoint}]:`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    if (error.response) {
      const statusCode =
        error.response.status === 503
          ? HttpStatus.SERVICE_UNAVAILABLE
          : error.response.status >= 500
            ? HttpStatus.BAD_GATEWAY
            : error.response.status;

      const message =
        error.response.data?.message ||
        (error.response.status === 503
          ? "DigiLocker verification service is currently unavailable. Please try again later."
          : `DigiLocker API request failed: ${error.message}`);

      throw new ApiError(
        message,
        statusCode,
        ErrorCode.UNEXPECTED_ERROR,
        error.response.data || null,
      );
    } else if (error.request) {
      throw new ApiError(
        "Unable to connect to DigiLocker verification service. Please try again later.",
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.UNEXPECTED_ERROR,
      );
    } else {
      throw ApiError.internal(`DigiLocker client error: ${error.message}`);
    }
  }
};

/** Access token extraction helper */
export const extractAccessToken = (res) => {
  const d = res?.data;
  if (typeof d === "string") return d;
  if (d && typeof d === "object") {
    return (
      d.access_token ||
      d.accessToken ||
      d.token ||
      d.details?.access_token ||
      null
    );
  }
  return null;
};

/** Issued files list extraction helper — Spec Section 6 */
export const extractIssuedFiles = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === "object") {
    if (Array.isArray(d.data)) return d.data;
    if (Array.isArray(d.files)) return d.files;
    if (Array.isArray(d.issued_files)) return d.issued_files;
    if (Array.isArray(d.issuedFiles)) return d.issuedFiles;
    if (Array.isArray(d.documents)) return d.documents;
  }
  return [];
};

export const extractXmlData = (res) => {
  if (!res) return null;
  if (typeof res === "string") return decodeBase64Xml(res);
  const d = res?.data;
  if (typeof d === "string") return decodeBase64Xml(d);
  if (d && typeof d === "object") {
    const rawVal =
      d.xml ||
      d.file ||
      d.xmlData ||
      d.base64 ||
      d.document ||
      d.xmlString ||
      d.file_data ||
      d.fileData ||
      d.content ||
      d.data ||
      null;
    if (typeof rawVal === "string") return decodeBase64Xml(rawVal);
    if (typeof rawVal === "object") return rawVal;
  }
  if (res?.raw) return extractXmlData(res.raw);
  return res;
};

/**
 * API 1: Initiate Session — Spec Section 4
 * POST /digilocker/initiate_session
 * Request Parameters (multipart/form-data):
 *   refid (String, Mandatory: Yes)
 *   redirect_url (String, Mandatory: Yes)
 */
export const initiateDigiLockerSessionApi = async (refid, redirectUrl) => {
  const actualRefId = typeof refid === "object" ? refid.refid : refid;
  const actualRedirectUrl =
    typeof refid === "object"
      ? refid.redirectUrl || refid.redirect_url
      : redirectUrl;
  console.log("[DigiLocker Wrapper] Calling API 1: Initiate Session", {
    refid: actualRefId,
    redirect_url: actualRedirectUrl,
  });
  return executeDigiLockerRequest("/digilocker/initiate_session", {
    refid: actualRefId,
    redirect_url:
      actualRedirectUrl ||
      "https://sahayaone-onboarding.netlify.app/digilocker-callback",
  });
};

/**
 * API 2: Generate Access Token — Spec Section 5
 * POST /digilocker/access_token
 * Request Parameters (multipart/form-data):
 *   refid (String, Mandatory: Yes)
 */
export const generateAccessTokenApi = async (refid) => {
  const actualRefId = typeof refid === "object" ? refid.refid : refid;
  console.log("[DigiLocker Wrapper] Calling API 2: Generate Access Token", {
    refid: actualRefId,
  });
  return executeDigiLockerRequest("/digilocker/access_token", {
    refid: actualRefId,
  });
};

export const fetchIssuedFilesApi = async (refid) => {
  const actualRefId = typeof refid === "object" ? refid.refid : refid;
  console.log("[DigiLocker Wrapper] Calling API 3: Fetch Issued Documents", {
    refid: actualRefId,
  });
  return executeDigiLockerRequest("/digilocker/issued_files", {
    refid: actualRefId,
  });
};

export const downloadXmlDocumentApi = async (refid, uri) => {
  const actualRefId = typeof refid === "object" ? refid.refid : refid;
  const actualUri =
    typeof refid === "object" ? refid.uri || refid.document_uri : uri;
  console.log("[DigiLocker Wrapper] Calling API 4: Download XML Document", {
    refid: actualRefId,
    uri: actualUri,
  });
  return executeDigiLockerRequest("/digilocker/download_xml", {
    refid: actualRefId,
    uri: actualUri,
  });
};
