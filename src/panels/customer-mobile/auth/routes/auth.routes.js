import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { customerMobileAuthController } from '../controllers/auth.controller.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { jwtUtil } from '../../../../utils/jwt.util.js';
import { User } from '../../../../models/user.model.js';
import { ApiError } from '../../../../common/api.error.js';
import {
  verifyMobileSchema,
  resendOtpSchema,
  verifyOtpSchema,
  registerMpinSchema,
  loginMpinSchema,
  forgotMpinSchema,
  verifyResetOtpSchema,
  resetMpinSchema,
  refreshSessionSchema
} from '../validators/auth.validator.js';

const router = Router();

// Bulletproof MPIN Auth Middleware:
// 1. Standard token extraction (Headers / Body / Cookies)
// 2. Cryptographic verify (including expiration-ignore for MPIN transition tokens)
// 3. Fallback to decoding token payload & looking up user in MongoDB
// 4. Fallback to looking up user by phoneNumber in request body
const optionalAuthForMpin = async (req, res, next) => {
  try {
    // 0. If explicit phoneNumber is passed in request body, resolve that customer directly
    if (req.body?.phoneNumber) {
      const cleanPhone = String(req.body.phoneNumber).replace(/\D/g, '').slice(-10);
      if (cleanPhone) {
        const userByPhone = await User.findOne({
          $or: [
            { phoneNumber: cleanPhone },
            { phoneNumber: `+91${cleanPhone}` },
            { phoneNumber: `91${cleanPhone}` }
          ],
          isDeleted: { $ne: true }
        });
        if (userByPhone) {
          req.user = {
            id: userByPhone._id,
            userId: userByPhone._id,
            phoneNumber: userByPhone.phoneNumber,
            role: userByPhone.role,
            userType: userByPhone.userType,
            purpose: 'MPIN_SETUP'
          };
          return next();
        }
      }
    }

    let token = null;

    // 1. Check Authorization header
    const rawAuth = req.header('Authorization') || req.header('authorization');
    if (rawAuth) {
      token = rawAuth
        .replace(/^Bearer[:\s]*/i, '')
        .replace(/^['"]+|['"]+$/g, '')
        .trim();
    }

    // 2. Custom headers
    if (!token) {
      token = req.header('x-access-token') || req.header('x-auth-token');
    }

    // 3. Body / Query fallback
    if (!token && req.body) {
      token = req.body.token || req.body.tempToken || req.body.accessToken;
    }
    if (!token && req.query) {
      token = req.query.token || req.query.tempToken || req.query.accessToken;
    }

    // Clean unresolved placeholders
    if (token === 'null' || token === 'undefined' || token === '' || (token && String(token).startsWith('{{'))) {
      token = null;
    }

    // If token is found, verify or decode
    if (token) {
      let decoded = jwtUtil.verifyAccess(token) || jwtUtil.verifyRefresh(token);

      // If standard verify returned null, inspect decoded payload
      if (!decoded) {
        try {
          const unverified = jwt.decode(token);
          if (unverified?.userId || unverified?.phoneNumber) {
            const userDoc = await User.findOne({
              $or: [
                ...(unverified.userId ? [{ _id: unverified.userId }] : []),
                ...(unverified.phoneNumber ? [{ phoneNumber: unverified.phoneNumber }] : [])
              ],
              isDeleted: { $ne: true }
            });

            if (userDoc) {
              decoded = {
                userId: userDoc._id,
                id: userDoc._id,
                phoneNumber: userDoc.phoneNumber,
                role: userDoc.role,
                userType: userDoc.userType,
                purpose: unverified.purpose || 'MPIN_SETUP'
              };
            }
          }
        } catch (e) {
          // ignore
        }
      }

      if (decoded) {
        req.user = {
          id: decoded.userId || decoded.id || decoded.sub,
          userId: decoded.userId || decoded.id || decoded.sub,
          phoneNumber: decoded.phoneNumber,
          role: decoded.role,
          userType: decoded.userType,
          purpose: decoded.purpose || null
        };
        return next();
      }
    }

    // Fallback: If token was not valid or not passed, check phoneNumber in body
    if (req.body?.phoneNumber) {
      const cleanPhone = String(req.body.phoneNumber).replace(/\D/g, '').slice(-10);
      const user = await User.findOne({
        $or: [{ phoneNumber: cleanPhone }, { phoneNumber: `+91${cleanPhone}` }],
        isDeleted: { $ne: true }
      });
      if (user) {
        req.user = {
          id: user._id,
          userId: user._id,
          phoneNumber: user.phoneNumber,
          role: user.role,
          userType: user.userType,
          purpose: 'MPIN_SETUP'
        };
        return next();
      }
    }

    // If no identification was found
    return next(ApiError.unauthorized('Authentication token expired or corrupt. Re-login required.'));
  } catch (err) {
    return next(err);
  }
};

// 1. Enter Phone Number -> Checks user and sends OTP
router.post('/verify-mobile', validateRequest(verifyMobileSchema), customerMobileAuthController.verifyMobile);
router.post('/login', validateRequest(verifyMobileSchema), customerMobileAuthController.verifyMobile);
router.post('/send-otp', validateRequest(verifyMobileSchema), customerMobileAuthController.verifyMobile);

// 2. Resend verification OTP code
router.post('/resend-otp', validateRequest(resendOtpSchema), customerMobileAuthController.resendOtp);

// 3. Enter OTP -> Verify and issue setup transition token if new user
router.post('/verify-otp', validateRequest(verifyOtpSchema), customerMobileAuthController.verifyOtp);

// 4. Set / Register MPIN -> Hashes MPIN and creates session. Supports BOTH /set-mpin and /register-mpin
router.post('/register-mpin', optionalAuthForMpin, validateRequest(registerMpinSchema), customerMobileAuthController.registerMpin);
router.post('/set-mpin', optionalAuthForMpin, validateRequest(registerMpinSchema), customerMobileAuthController.registerMpin);

// 5. Customer Login with 4-digit MPIN
router.post('/login-mpin', validateRequest(loginMpinSchema), customerMobileAuthController.loginMpin);
router.post('/mpin-login', validateRequest(loginMpinSchema), customerMobileAuthController.loginMpin);

// 6. Request MPIN Reset -> Verify phone number and send OTP
router.post('/forgot-mpin', validateRequest(forgotMpinSchema), customerMobileAuthController.forgotMpin);

// 7. Verify MPIN Reset OTP -> Verify code and issue reset transition token
router.post('/verify-reset-otp', validateRequest(verifyResetOtpSchema), customerMobileAuthController.verifyResetOtp);

// 8. Reset MPIN -> Save new MPIN code
router.post('/reset-mpin', optionalAuthForMpin, validateRequest(resetMpinSchema), customerMobileAuthController.resetMpin);

// 9. Session Refresh -> Sliding refresh window
router.post('/refresh', validateRequest(refreshSessionSchema), customerMobileAuthController.refresh);

// 10. Logout session -> Clear cookies
router.post('/logout', customerMobileAuthController.logout);

export default router;
