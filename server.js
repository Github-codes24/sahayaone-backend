// Enforce Indian Standard Time (IST, UTC+05:30) globally
process.env.TZ = process.env.TZ || process.env.TIMEZONE || "Asia/Kolkata";

import dotenv from "dotenv";
import { startServer } from "./src/server.js";
import { logger } from "./src/utils/logger.util.js";

// Load environment variables immediately on startup
dotenv.config({ override: true });
process.env.TZ = process.env.TZ || process.env.TIMEZONE || "Asia/Kolkata";

// Track unexpected exceptions and rejections globally
process.on("uncaughtException", (error) => {
  console.error("CRITICAL: Uncaught Exception detected:", error);
  logger.error("CRITICAL: Uncaught Exception detected", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("CRITICAL: Unhandled Promise Rejection detected:", reason);
  logger.error("CRITICAL: Unhandled Promise Rejection detected", {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

// Start server instance
startServer();
