import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.config.js';

export const jwtUtil = {
  signAccess: (payload, customExpiry = null) => {
    return jwt.sign(payload, jwtConfig.accessSecret, {
      expiresIn: customExpiry || jwtConfig.accessExpiration
    });
  },

  signRefresh: (payload, customExpiry = null) => {
    return jwt.sign(payload, jwtConfig.refreshSecret, {
      expiresIn: customExpiry || jwtConfig.refreshExpiration
    });
  },

  verifyAccess: (token) => {
    try {
      if (!token || typeof token !== 'string') return null;
      const cleanToken = token
        .replace(/^Bearer[:\s]*/i, '')
        .replace(/^['"]+|['"]+$/g, '')
        .trim();
      
      try {
        return jwt.verify(cleanToken, jwtConfig.accessSecret);
      } catch (verifyErr) {
        if (verifyErr.name === 'TokenExpiredError') {
          // Allow expired tokens for MPIN configuration or smooth re-auth
          return jwt.verify(cleanToken, jwtConfig.accessSecret, { ignoreExpiration: true });
        }
        return null;
      }
    } catch (error) {
      return null;
    }
  },

  verifyRefresh: (token) => {
    try {
      if (!token || typeof token !== 'string') return null;
      const cleanToken = token
        .replace(/^Bearer[:\s]*/i, '')
        .replace(/^['"]+|['"]+$/g, '')
        .trim();
      
      try {
        return jwt.verify(cleanToken, jwtConfig.refreshSecret);
      } catch (verifyErr) {
        if (verifyErr.name === 'TokenExpiredError') {
          return jwt.verify(cleanToken, jwtConfig.refreshSecret, { ignoreExpiration: true });
        }
        return null;
      }
    } catch (error) {
      return null;
    }
  }
};
