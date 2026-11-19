import { ApiError } from '../common/api.error.js';
import { logger } from '../utils/logger.util.js';

function sanitizeXss(val) {
  if (typeof val === 'string') {
    return val.replace(/<script[^>]*>([\S\s]*?)<\/script>/gi, '').trim();
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeXss);
  }
  if (typeof val === 'object' && val !== null) {
    const clean = {};
    for (const key of Object.keys(val)) {
      clean[key] = sanitizeXss(val[key]);
    }
    return clean;
  }
  return val;
}

export const securityMiddleware = {
  xssSanitizer: (req, res, next) => {
    if (req.body) req.body = sanitizeXss(req.body);
    if (req.query) req.query = sanitizeXss(req.query);
    if (req.params) req.params = sanitizeXss(req.params);
    next();
  },

  deviceTracker: (req, res, next) => {
    const platform = req.header('X-App-Platform');
    const deviceId = req.header('X-Device-Id');

    req.deviceContext = {
      platform: platform || 'UNKNOWN',
      deviceId: deviceId || 'UNKNOWN',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    next();
  },

  csrfCheck: (req, res, next) => {
    const sourcePlatform = req.header('X-App-Platform');
    if (['WEB_ADMIN', 'WEB_EMPLOYEE'].includes(sourcePlatform) && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const csrfHeader = req.header('X-CSRF-Token');
      if (!csrfHeader) {
        logger.warn(`SECURITY: Blocked attempt due to missing CSRF token header`, { ip: req.ip });
        return next(ApiError.forbidden('CSRF validation handshake failed. Access Denied.'));
      }
    }
    next();
  }
};
