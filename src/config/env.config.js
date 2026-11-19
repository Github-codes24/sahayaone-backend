import dotenv from "dotenv";
dotenv.config({ override: true });

process.env.TZ = process.env.TZ || process.env.TIMEZONE || "Asia/Kolkata";

const requiredEnvVars = ["MONGO_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "ENCRYPTION_KEY"];

const missing = requiredEnvVars.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`CRITICAL STARTUP ERROR: Missing required configuration keys: ${missing.join(", ")}`);
}

export const envConfig = Object.freeze({
  appName: process.env.APP_NAME || "Sahayaone ERP",
  nodeEnv: process.env.NODE_ENV || "development",
  timezone: process.env.TIMEZONE || process.env.TZ || "Asia/Kolkata",
  port: parseInt(process.env.PORT || "5000", 10),
  apiPrefix: process.env.API_PREFIX || "/api/v1",
  appUrl: process.env.APP_URL || "http://localhost:5000",
  encryptionKey: process.env.ENCRYPTION_KEY,
  otpExpirationMinutes: parseInt(process.env.OTP_EXPIRATION_MINUTES || "5", 10),
  msg91AuthKey: process.env.MSG91_AUTH_KEY || "554888AWfuLg9q9pXN6a6b3658P1",
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "AIzaSyDc5r82MahA9rhAXROP0kv7rf0ZzUKOFR4"
});
