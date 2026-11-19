import { jwtUtil } from '../utils/jwt.util.js';
import { ApiError } from '../common/api.error.js';
import { UserRole } from '../constants/user-role.constant.js';

export const rbacMiddleware = {
  requireAuth: (req, res, next) => {
    let token = null;

    // Helper to extract cookie token
    const extractCookieToken = () => {
      if (!req.headers.cookie) return null;
      const cookieHeader = req.headers.cookie;
      const getCookie = (name) => {
        const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
        return match ? decodeURIComponent(match[1]) : null;
      };
      return (
        getCookie('access_token') ||
        getCookie('accessToken') ||
        getCookie('token') ||
        getCookie('refresh_token') ||
        getCookie('refreshToken')
      );
    };

    // 1. Check Authorization header (Bearer <token>, Bearer:<token>, bearer <token>, or raw <token>)
    const authHeader = req.header('Authorization') || req.header('authorization');
    if (authHeader) {
      token = authHeader
        .replace(/^Bearer[:\s]*/i, '')
        .replace(/^['"]+|['"]+$/g, '')
        .trim();
    }

    // Clean placeholder / empty tokens
    if (token === 'null' || token === 'undefined' || token === '' || (token && String(token).startsWith('{{'))) {
      token = null;
    }

    // 2. Check Custom headers (x-access-token, x-auth-token)
    if (!token) {
      token = req.header('x-access-token') || req.header('x-auth-token');
      if (token === 'null' || token === 'undefined' || token === '' || (token && token.startsWith('{{'))) {
        token = null;
      }
    }

    // 3. Check Cookie headers
    if (!token) {
      token = extractCookieToken();
    }

    // 4. Check Body and Query fallback (e.g. tempToken, token, accessToken)
    if (!token && req.body) {
      token = req.body.token || req.body.tempToken || req.body.accessToken;
      if (token === 'null' || token === 'undefined' || token === '' || (token && String(token).startsWith('{{'))) {
        token = null;
      }
    }
    if (!token && req.query) {
      token = req.query.token || req.query.tempToken || req.query.accessToken;
      if (token === 'null' || token === 'undefined' || token === '' || (token && String(token).startsWith('{{'))) {
        token = null;
      }
    }

    if (!token) {
      return next(ApiError.unauthorized('Authentication token signature not found. Access denied.'));
    }

    // 4. Verify token (try access token secret first, fallback to refresh token secret)
    let decoded = jwtUtil.verifyAccess(token);
    if (!decoded) {
      decoded = jwtUtil.verifyRefresh(token);
    }

    // If header token was invalid/corrupt, check if cookie has valid token before failing
    if (!decoded) {
      const cookieToken = extractCookieToken();
      if (cookieToken && cookieToken !== token) {
        decoded = jwtUtil.verifyAccess(cookieToken) || jwtUtil.verifyRefresh(cookieToken);
      }
    }

    if (!decoded) {
      return next(ApiError.unauthorized('Authentication token expired or corrupt. Re-login required.'));
    }

    const activeMerchantId =
      req.header('x-merchant-id') ||
      req.header('x-store-id') ||
      req.query?.merchantId ||
      decoded.merchantId ||
      null;

    const activeBankId =
      req.header('x-bank-id') ||
      req.query?.bankId ||
      decoded.bankId ||
      decoded.societyId ||
      null;

    const activeBranchId =
      req.header('x-branch-id') ||
      req.query?.branchId ||
      decoded.branchId ||
      null;

    req.user = {
      id: decoded.userId || decoded.id || decoded.sub,
      userId: decoded.userId || decoded.id || decoded.sub,
      email: decoded.email,
      phoneNumber: decoded.phoneNumber,
      role: decoded.role,
      userType: decoded.userType,
      isBankOwner: decoded.isBankOwner || decoded.isOwner || (decoded.role && decoded.role.toUpperCase().includes('OWNER')) || false,
      permissions: decoded.permissions || [],
      branchId: activeBranchId,
      bankId: activeBankId,
      societyId: activeBankId,
      profileId: decoded.profileId || null,
      merchantId: activeMerchantId,
      storeId: activeMerchantId,
      shopName: decoded.shopName || null,
      purpose: decoded.purpose || null
    };

    next();
  },

  requireRoles: (allowedRoles) => {
    return (req, res, next) => {
      if (!req.user) {
        return next(ApiError.unauthorized('User identity not loaded. Access Denied.'));
      }

      const roleUpper = (req.user.role || '').toString().toUpperCase().replace(/[\s_]+/g, '_');
      const userTypeUpper = (req.user.userType || '').toString().toUpperCase().replace(/[\s_]+/g, '_');
      const emailUpper = (req.user.email || '').toString().toUpperCase();

      const isSuperAdmin = roleUpper === 'SUPER_ADMIN' || userTypeUpper === 'SUPER_ADMIN';

      const isBankOwnerOrAdmin =
        Boolean(req.user.isBankOwner) ||
        roleUpper.includes('BANK') ||
        roleUpper.includes('SOCIETY') ||
        roleUpper.includes('ADMIN') ||
        roleUpper.includes('OWNER') ||
        roleUpper.includes('HEAD') ||
        roleUpper.includes('AUTHORIZED') ||
        userTypeUpper === 'ADMIN' ||
        emailUpper.includes('BANK');

      const hasRole =
        isSuperAdmin ||
        isBankOwnerOrAdmin ||
        allowedRoles.some(allowedRole => {
          const allowedRoleNormalized = allowedRole?.toUpperCase().replace(/[\s_]+/g, '_');
          return (
            allowedRoleNormalized === roleUpper ||
            allowedRoleNormalized === userTypeUpper
          );
        });

      if (!hasRole) {
        return next(ApiError.forbidden('Access forbidden. Required role privileges missing.'));
      }

      next();
    };
  },

  requirePermission: (permission) => {
    return (req, res, next) => {
      if (!req.user) {
        return next(ApiError.unauthorized('User identity not loaded. Access Denied.'));
      }

      const userRoleNormalized = req.user.role?.toUpperCase().replace(/[\s_]+/g, '_');
      const isSuperAdmin = userRoleNormalized === 'SUPER_ADMIN';

      if (isSuperAdmin || req.user.permissions.includes('ALL_PERMISSIONS') || req.user.permissions.includes('*:*')) {
        return next();
      }

      const hasPermission = req.user.permissions.includes(permission);
      if (!hasPermission) {
        return next(ApiError.forbidden(`Required capability [${permission}] is not allocated to your session.`));
      }

      next();
    };
  }
};
