import dns from "dns";
import mongoose from "mongoose";
import { databaseConfig } from "../config/database.config.js";
import { logger } from "../utils/logger.util.js";

// Ensure reliable SRV resolution across environments
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (_) {}

mongoose.connection.on("connected", () => {
  logger.info("DATABASE CONNECTED: Connection pool successfully established.");
});

mongoose.connection.on("error", (err) => {
  logger.error(`DATABASE EXCEPTION: Pool connection error: ${err.message}`, {
    error: err,
  });
});

mongoose.connection.on("disconnected", () => {
  logger.warn("DATABASE WARN: Mongoose connection disconnected.");
});

export async function connectDatabase() {
  const { uri, options } = databaseConfig;
  const fallbackUri = process.env.MONGO_FALLBACK_URI;

  try {
    logger.info(`DATABASE CONNECTING: Establishing connection pool...`);
    await mongoose.connect(uri, options);
  } catch (error) {
    if (
      fallbackUri &&
      (error.code === 'ECONNREFUSED' || error.syscall === 'querySrv' || error.message?.includes('querySrv'))
    ) {
      logger.warn(`DATABASE WARN: SRV resolution failed (${error.message}). Retrying with MONGO_FALLBACK_URI from ENV...`);
      try {
        await mongoose.connect(fallbackUri, options);
        return;
      } catch (fallbackError) {
        logger.error(`DATABASE CRITICAL: Fallback connection failure: ${fallbackError.message}`);
        throw fallbackError;
      }
    }
    logger.error(
      `DATABASE CRITICAL: Initial pool connection failure: ${error.message}`,
    );
    throw error;
  }
}

export async function disconnectDatabase() {
  try {
    logger.info("DATABASE DISCONNECTING: Closing connection pool...");
    await mongoose.disconnect();
    logger.info("DATABASE DISCONNECTED: Connection pool cleanly released.");
  } catch (error) {
    logger.error(
      `DATABASE EXCEPTION: Error closing database pool: ${error.message}`,
    );
  }
}
