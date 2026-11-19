import { logger } from '../utils/logger.util.js';

export const auditLogger = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const responseTime = Date.now() - startTime;
      const user = req.user ? `${req.user.role}:${req.user.id}` : 'ANONYMOUS';

      logger.info(`AUDIT TRAIL: User [${user}] executed ${req.method} on [${req.originalUrl}] - Status: ${res.statusCode} (${responseTime}ms)`, {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        deviceContext: req.deviceContext || null,
        body: req.method !== 'DELETE' ? req.body : undefined
      });
    }
  });

  if (req.user && req.body) {
    if (req.method === 'POST') {
      req.body.createdBy = req.user.id;
      req.body.updatedBy = req.user.id;
    } else if (['PUT', 'PATCH'].includes(req.method)) {
      req.body.updatedBy = req.user.id;
    }
  }

  next();
};
