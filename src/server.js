process.env.TZ = process.env.TZ || process.env.TIMEZONE || "Asia/Kolkata";

import http from "http";
import app from "./app.js";
import { connectDatabase, disconnectDatabase } from "./database/connection.js";
import { logger } from "./utils/logger.util.js";
import { envConfig } from "./config/env.config.js";

let server;

export async function startServer() {
  const PORT = envConfig.port || 5000;

  try {
    // 1. Establish Database Connection First
    await connectDatabase();

    // 2. Instantiate HTTP Server wrapping Express App
    server = http.createServer(app);

    // 3. Begin Listening
    server.listen(PORT, () => {
      logger.info(`SERVER RUNNING: http://localhost:${PORT} in [${envConfig.nodeEnv}] mode`);
    });

    // 4. Set Up Graceful Shutdown Handler
    const shutdown = async (signal) => {
      logger.info(`SHUTDOWN: Received ${signal}. Starting graceful shutdown...`);

      if (server) {
        server.close(async () => {
          logger.info("HTTP Server stopped accepting connections.");
          await disconnectDatabase();
          logger.info("Database pool released. Exiting.");
          process.exit(0);
        });

        setTimeout(() => {
          logger.error("SHUTDOWN: Graceful shutdown timed out. Forcing exit.");
          process.exit(1);
        }, 10000);
      } else {
        process.exit(0);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("CRITICAL: Server initialization failed:", error);
    logger.error("CRITICAL: Server initialization failed", { error: error.message });
    process.exit(1);
  }
}
