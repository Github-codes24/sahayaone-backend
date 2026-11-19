import { envConfig } from './env.config.js';

export const rateLimitOptions = Object.freeze({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100000', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests originating from this IP address. Please try again after 15 minutes.'
  },
  skip: (req) =>
    envConfig.nodeEnv === 'development' ||
    req.path === '/' ||
    req.path === '/health' ||
    req.path.startsWith('/health/') ||
    req.path === '/api/v1/health'
});

export const serverLimits = Object.freeze({
  keepAliveTimeout: 65000,
  headersTimeout: 66000,
  requestTimeout: 60000
});
