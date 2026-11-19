import jwt from "jsonwebtoken";

/**
 * Generates dynamic JWT Token for DigiLocker API requests according to spec Section 2.1 & 2.2
 * Algorithm: HS256
 * Validity: 5 Minutes
 * Payload: { timestamp, partnerId, reqid }
 *
 * @param {string|null} customReqId Optional custom request ID
 * @returns {string} Signed JWT Token
 */
export const generateDigiLockerJwt = (customReqId = null) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const isProd = true;
  const partnerId = isProd
    ? process.env.DIGILOCKER_PROD_PARTNER_ID ||
      process.env.DIGILOCKER_PARTNER_ID
    : process.env.DIGILOCKER_UAT_PARTNER_ID ||
      process.env.DIGILOCKER_PARTNER_ID;
  const secretKey = isProd
    ? process.env.DIGILOCKER_PROD_JWT_SECRET ||
      process.env.DIGILOCKER_JWT_SECRET
    : process.env.DIGILOCKER_UAT_JWT_SECRET ||
      process.env.DIGILOCKER_JWT_SECRET;
  const reqid =
    customReqId || `REQ_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  const payload = {
    timestamp,
    partnerId,
    reqid,
  };

  console.log(
    "\n================================================================",
  );
  console.log(
    "[DigiLocker JWT] Generating fresh JWT Token (Spec Section 2.1 & 2.2)",
  );
  console.log("[DigiLocker JWT] Payload:", JSON.stringify(payload, null, 2));
  console.log("[DigiLocker JWT] Algorithm: HS256 | Validity: 5 minutes");

  const token = jwt.sign(payload, secretKey, {
    algorithm: "HS256",
    noTimestamp: true,
  });

  console.log(
    `[DigiLocker JWT] Token generated: ${token.slice(0, 30)}...${token.slice(-15)}`,
  );
  console.log(
    "================================================================\n",
  );

  return token;
};
