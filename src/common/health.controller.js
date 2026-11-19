import mongoose from "mongoose";
import { envConfig } from "../config/env.config.js";

const READY_STATE_MAP = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

/**
 * Converts process uptime in seconds to a human-readable duration string.
 */
function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);

  return parts.join(" ");
}

/**
 * Returns formatted Node.js memory metrics in MB.
 */
function getMemoryUsage() {
  const memory = process.memoryUsage();
  return {
    rss: `${(memory.rss / (1024 * 1024)).toFixed(2)} MB`,
    heapTotal: `${(memory.heapTotal / (1024 * 1024)).toFixed(2)} MB`,
    heapUsed: `${(memory.heapUsed / (1024 * 1024)).toFixed(2)} MB`,
  };
}

/**
 * Full health check controller.
 * Evaluates core server availability, database connectivity, and resource usage.
 */
export function getHealth(req, res) {
  const dbStateCode = mongoose.connection.readyState;
  const dbStateName = READY_STATE_MAP[dbStateCode] || "unknown";
  const isDbConnected = dbStateCode === 1;

  // If the database is disconnected, report service as degraded/unhealthy with HTTP 503
  const isHealthy = isDbConnected;
  const httpStatus = isHealthy ? 200 : 503;

  return res.status(httpStatus).json({
    status: isHealthy ? "healthy" : "unhealthy",
    message: isHealthy
      ? "API Gateway and dependencies are operational."
      : "API service is degraded: database is disconnected.",
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(process.uptime()),
      formatted: formatUptime(process.uptime()),
    },
    environment: envConfig.nodeEnv,
    services: {
      database: {
        status: dbStateName,
        connected: isDbConnected,
      },
    },
    memory: getMemoryUsage(),
  });
}

/**
 * Lightweight liveness probe.
 * Quickly confirms whether the Express event loop is responding.
 */
export function getLiveness(req, res) {
  return res.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString(),
  });
}
