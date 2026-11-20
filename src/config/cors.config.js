import { envConfig } from './env.config.js';

// Predefined trusted domains (can be overridden or extended via .env)
const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5000',
  'http://localhost:5001',
  'http://localhost:5002',
  'https://sahayaone-superadmin-panel.netlify.app',
  'https://sahayaone-cooperative-bank-panel.netlify.app',
  'https://sahayaoneexecutive.expo.app',
  'https://sahayaone.expo.app',
  'https://sahayaoneonboard.expo.app',
  'https://sahayaone-merchant-panel.netlify.app',
  'https://sahayaone-merchant-panel.netlify.app'
];

export const corsOptions = {
  origin: (origin, callback) => {
    // 1. Allow non-browser requests (e.g. Postman, mobile apps, server-to-server, curl)
    if (!origin) {
      return callback(null, true);
    }

    const envOrigins = process.env.CORS_ALLOWED_ORIGINS;

    // 2. Allow all if wildcard is configured
    if (envOrigins === '*') {
      return callback(null, true);
    }

    // 3. Parse configured origins from environment variable and merge with defaultAllowedOrigins
    const parsedEnvOrigins = envOrigins
      ? envOrigins.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean)
      : [];
    const configuredOrigins = Array.from(new Set([...defaultAllowedOrigins, ...parsedEnvOrigins]));

    const normalizedOrigin = origin.replace(/\/$/, '');

    // 4. Check exact match
    if (configuredOrigins.includes(normalizedOrigin) || configuredOrigins.includes('*')) {
      return callback(null, true);
    }

    // 5. Allow all Netlify, Vercel, Render, and Expo preview/production subdomains
    if (
      /\.netlify\.app$/.test(normalizedOrigin) ||
      /\.vercel\.app$/.test(normalizedOrigin) ||
      /\.onrender\.com$/.test(normalizedOrigin) ||
      /\.expo\.app$/.test(normalizedOrigin) ||
      /\.expo\.dev$/.test(normalizedOrigin) ||
      /^https?:\/\/localhost(:\d+)?$/.test(normalizedOrigin)
    ) {
      return callback(null, true);
    }

    // Reject without throwing an unhandled exception (prevents 500 crashes)
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-App-Platform',
    'X-Device-Id',
    'Access-Control-Allow-Origin'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true,
  optionsSuccessStatus: 204
};