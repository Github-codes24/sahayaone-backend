import { BaseController } from '../../../../common/base.controller.js';
import { societyProfileService } from '../services/society-profile.service.js';

// Controller Methods (Add inside your society profile controller)
import { Bank } from '../../../../models/bank.model.js';
import { RazorpayHelper } from '../../../../utils/razorpay.helper.js';
import { ApiError } from '../../../../common/api.error.js';
import { logger } from "../../../../utils/logger.util.js";

const razorpayHelper = new RazorpayHelper();

export class SocietyProfileController extends BaseController {
  constructor() {
    super();
    this.getProfile = this.getProfile.bind(this);
    this.updateProfile = this.updateProfile.bind(this);
    this.changePassword = this.changePassword.bind(this);
  }

  /**
   * GET /api/v1/society/profile
   */
  async getProfile(req, res, next) {
    try {
      const profile = await societyProfileService.getProfile(req.user.id);
      return this.sendSuccess(res, profile, 'Profile retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/society/profile
   * PATCH /api/v1/society/profile
   */
  async updateProfile(req, res, next) {
    try {
      const file = req.file || (req.files && (req.files.avatar?.[0] || req.files.profileImage?.[0] || req.files.file?.[0]));
      const updatedProfile = await societyProfileService.updateProfile(req.user.id, req.body, file);
      return this.sendSuccess(res, updatedProfile, 'Profile updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/society/profile/change-password
   * PUT /api/v1/society/profile/change-password
   */
  async changePassword(req, res, next) {
    try {
      const result = await societyProfileService.changePassword(req.user.id, req.body);
      return this.sendSuccess(res, result, result.message || 'Password changed successfully.');
    } catch (error) {
      next(error);
    }
  }
}




/**
 * 1. GET /api/v1/society/profile/razorpay/status
 * Checks if the logged-in Cooperative Bank has connected Razorpay
 */
export const getRazorpayConnectionStatus = async (req, res, next) => {
  try {
    // 1. Agar token hai toh usse dhoondho, warna query (?bankId=...) se, warna DB ka pehla bank utha lo
    let bank = null;

    if (req.user?.profileId || req.user?._id) {
      bank = await Bank.findOne({
        $or: [{ _id: req.user?.profileId }, { userId: req.user?._id }],
      }).select("name razorpay.isConnected razorpay.accountId razorpay.connectedAt");
    }

    if (!bank && req.query.bankId) {
      bank = await Bank.findById(req.query.bankId).select(
        "name razorpay.isConnected razorpay.accountId razorpay.connectedAt"
      );
    }

    // Fallback for local Thunder Client testing: DB me jo bhi pehla bank mile wo le lo
    if (!bank) {
      bank = await Bank.findOne().select(
        "name razorpay.isConnected razorpay.accountId razorpay.connectedAt"
      );
    }

    if (!bank) throw ApiError.notFound("Cooperative Bank profile not found in DB.");

    return res.status(200).json({
      success: true,
      data: {
        bankId: bank._id,
        bankName: bank.name,
        isConnected: Boolean(bank.razorpay?.isConnected),
        accountId: bank.razorpay?.accountId || null,
        connectedAt: bank.razorpay?.connectedAt || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. GET /api/v1/society/profile/razorpay/connect
 * Generates Razorpay OAuth URL when Bank clicks "Connect to Razorpay"
 */
export const initiateRazorpayConnect = async (req, res, next) => {
  // try {
  //   const bank = await Bank.findOne({
  //     $or: [{ _id: req.user?.profileId }, { userId: req.user?.userId || req.user?._id || req.query.bankId}],
  //   });

  //   if (!bank) throw ApiError.notFound("Cooperative Bank profile not found.");

  //   // CHECK 1: Prevent re-linking if this bank is already connected
  //   if (bank.razorpay?.isConnected && bank.razorpay?.accountId) {
  //     throw ApiError.conflict(
  //       `Your bank is already connected with Razorpay Account [${bank.razorpay.accountId}].`,
  //     );
  //   }

  //   const authorizeUrl = RazorPayHelper.getOAuthAuthorizeUrl(bank._id);

  //   return res.status(200).json({
  //     success: true,
  //     message: "Razorpay OAuth authorization URL generated.",
  //     data: {
  //       bankId: bank._id,
  //       authorizeUrl,
  //     },
  //   });
  // } catch (error) {
  //   next(error);
  // }

  try {
    let bank = null;

    // 1. Token se dhoondho (agar logged in hai)
    if (req.user?.profileId || req.user?._id || req.user?.userId) {
      bank = await Bank.findOne({
        $or: [
          { _id: req.user?.profileId },
          { userId: req.user?.userId || req.user?._id },
        ],
      });
    }

    // 2. Query parameter (?bankId=...) se dhoondho
    if (!bank && req.query.bankId) {
      bank = await Bank.findById(req.query.bankId);
    }

    // 3. Fallback: Local testing ke liye DB ka pehla bank utha lo
    if (!bank) {
      bank = await Bank.findOne();
    }

    if (!bank) throw ApiError.notFound("Cooperative Bank profile not found.");

    // CHECK 1: Prevent re-linking if this bank is already connected
    if (bank.razorpay?.isConnected && bank.razorpay?.accountId) {
      throw ApiError.conflict(
        `Your bank is already connected with Razorpay Account [${bank.razorpay.accountId}].`,
      );
    }

    // Safe call: works whether RazorPayHelper is imported as class or instance
    const helperInstance =
      typeof RazorpayHelper.getOAuthAuthorizeUrl === "function"
        ? RazorpayHelper
        : new RazorpayHelper();

    const authorizeUrl = helperInstance.getOAuthAuthorizeUrl(bank._id);

    return res.status(200).json({
      success: true,
      message: "Razorpay OAuth authorization URL generated.",
      data: {
        bankId: bank._id,
        authorizeUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. GET /api/v1/society/profile/razorpay/callback (PUBLIC ROUTE - Called by Razorpay)
 * Exchanges code for token & checks if accountId is already used by another bank
 */
export const handleRazorpayOAuthCallback = async (req, res) => {
  const frontendUrl =
    process.env.SOCIETY_FRONTEND_URL || "http://localhost:3000/society/settings";

  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      throw new Error(error_description || error);
    }

    if (!code || !state) {
      throw new Error("Missing authorization code or state parameter.");
    }

    // 1. Verify HMAC state & extract bankId
    const bankId = razorpayHelper.verifyOAuthState(state);
    if (!bankId) {
      throw new Error("Invalid or expired OAuth session state. Please try again.");
    }

    const bank = await Bank.findById(bankId);
    if (!bank) {
      throw new Error("Cooperative Bank record not found.");
    }

    // 2. Exchange authorization code for Razorpay Account ID & Tokens
    const tokenData = await razorpayHelper.exchangeOAuthToken(code);

    if (!tokenData.accountId) {
      throw new Error("Failed to retrieve Razorpay Account ID.");
    }

    // 3. CHECK 2 (CRITICAL): Check if this Razorpay Account ID is ALREADY linked to ANY OTHER bank
    const duplicateBank = await Bank.findOne({
      "razorpay.accountId": tokenData.accountId,
      _id: { $ne: bank._id },
    });

    if (duplicateBank) {
      logger.warn(
        `OAUTH DUPLICATE BLOCKED: Bank [${bank.name}] tried connecting Razorpay Account [${tokenData.accountId}] which is already used by [${duplicateBank.name}].`,
      );

      // If testing via Postman (Accept: application/json), return JSON error
      if (req.headers.accept?.includes("application/json")) {
        return res.status(409).json({
          success: false,
          message: `This Razorpay account (${tokenData.accountId}) is already linked to another bank on Sahayaone.`,
        });
      }

      return res.redirect(
        `${frontendUrl}?razorpay=error&message=${encodeURIComponent(
          `This Razorpay account (${tokenData.accountId}) is already linked to another bank.`,
        )}`,
      );
    }

    // 4. Save Sub-Merchant OAuth Details in Bank Document
    bank.razorpay = {
      isConnected: true,
      accountId: tokenData.accountId,
      publicToken: tokenData.publicToken,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      tokenExpiresAt: tokenData.tokenExpiresAt,
      connectedAt: new Date(),
    };

    await bank.save();

    logger.info(
      `RAZORPAY OAUTH SUCCESS: Bank [${bank.name}] (${bank._id}) connected to [${tokenData.accountId}]`,
    );

    if (req.headers.accept?.includes("application/json")) {
      return res.status(200).json({
        success: true,
        message: "Razorpay account connected successfully!",
        data: {
          bankId: bank._id,
          razorpayAccountId: tokenData.accountId,
          isConnected: true,
        },
      });
    }

    return res.redirect(
      `${frontendUrl}?razorpay=connected&accountId=${tokenData.accountId}`,
    );
  } catch (err) {
    logger.error(`Razorpay OAuth Callback Failed: ${err.message}`);

    if (req.headers.accept?.includes("application/json")) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    return res.redirect(
      `${frontendUrl}?razorpay=error&message=${encodeURIComponent(err.message)}`,
    );
  }
};


export const societyProfileController = new SocietyProfileController();
