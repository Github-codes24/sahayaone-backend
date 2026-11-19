import bcrypt from 'bcryptjs';
import { MerchantProfile } from '../../../../models/merchant-profile.model.js';
import { User } from '../../../../models/user.model.js';
import { UserRole, UserType } from '../../../../constants/user-role.constant.js';
import { storageManager } from '../../../../storage/storage.manager.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';

export class MerchantService {
  /**
   * Standardize merchant object output matching UI spec
   */
  formatMerchantResponse(merchant) {
    const docs = merchant.documents || {};
    const branchObj = merchant.branchId;
    let branchName = 'N/A';
    let branchId = null;

    if (branchObj && typeof branchObj === 'object') {
      branchName = branchObj.name || 'N/A';
      branchId = branchObj._id;
    } else if (branchObj) {
      branchId = branchObj;
    }

    return {
      id: merchant._id,
      merchantId: merchant._id,
      userId: merchant.userId,
      bankId: merchant.bankId || null,
      branchId: branchId,
      branchName: branchName,
      branch: branchName,
      shopName: merchant.shopName,
      ownerName: merchant.ownerName,
      shopOwnerName: merchant.ownerName,
      email: merchant.email,
      phoneNumber: merchant.phoneNumber,
      phone: merchant.phoneNumber,
      aadhaarNumber: merchant.aadhaarNumber || '',
      ownerAadharNumber: merchant.aadhaarNumber || '',
      ownerAadhaarNumber: merchant.aadhaarNumber || '',
      panNumber: merchant.panNumber || '',
      ownerPanNumber: merchant.panNumber || '',
      gstinNumber: merchant.gstinNumber || '',
      gstin: merchant.gstinNumber || '',
      documents: {
        ownerAadhaar: docs.ownerAadhaar ? { filename: 'owner_aadhaar.pdf', url: docs.ownerAadhaar } : null,
        ownerPan: docs.ownerPan ? { filename: 'owner_pan.jpg', url: docs.ownerPan } : null,
        shopRegistrationCertificate: docs.shopRegistrationCertificate ? { filename: 'shop_registration.pdf', url: docs.shopRegistrationCertificate } : null,
        gstCertificate: docs.gstCertificate ? { filename: 'gst_certificate.pdf', url: docs.gstCertificate } : null
      },
      status: merchant.status || 'ACTIVE',
      createdAt: merchant.createdAt,
      updatedAt: merchant.updatedAt
    };
  }

  /**
   * Helper to process file upload for a document key
   */
  async processFileUpload(fileArray, folder = 'merchants') {
    if (!fileArray || fileArray.length === 0) return { url: null, key: null };
    const file = fileArray[0];
    const uploadResult = await storageManager.uploadFile(file, folder);
    return {
      url: uploadResult?.fileUrl || uploadResult?.url || null,
      key: uploadResult?.key || uploadResult?.filePath || null
    };
  }

  /**
   * List Merchants with search, status filtering, and pagination
   */
  async listMerchants(queryOptions) {
    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const search = (queryOptions.search || '').trim();
    const status = queryOptions.status ? queryOptions.status.toUpperCase() : null;
    const skip = (page - 1) * limit;

    const filter = {
      isDeleted: { $ne: true }
    };

    if (status) {
      filter.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { shopName: searchRegex },
        { ownerName: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
        { gstinNumber: searchRegex },
        { panNumber: searchRegex }
      ];
    }

    const sortField = queryOptions.sortBy || 'createdAt';
    const sortOrder = (queryOptions.sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;

    const [merchants, totalRecords] = await Promise.all([
      MerchantProfile.find(filter)
        .populate('branchId', 'name code')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      MerchantProfile.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalRecords / limit);

    const items = merchants.map((m, idx) => ({
      srNo: skip + idx + 1,
      ...this.formatMerchantResponse(m)
    }));

    return {
      items,
      meta: {
        totalRecords,
        limit,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * Get single Merchant by ID
   */
  async getMerchantById(id) {
    const merchant = await MerchantProfile.findOne({ _id: id, isDeleted: { $ne: true } })
      .populate('branchId', 'name code')
      .lean();

    if (!merchant) {
      throw ApiError.notFound('Merchant not found.');
    }

    return this.formatMerchantResponse(merchant);
  }

  /**
   * Create a new Merchant (Images 1, 2, 3 UI)
   */
  async createMerchant(payload, files = {}, creatorId) {
    const shopName = (payload.shopName || '').trim();
    const ownerName = (payload.ownerName || payload.shopOwnerName || '').trim();
    const email = (payload.email || '').trim().toLowerCase();
    const phoneNumber = (payload.phoneNumber || payload.phone || '').trim();
    const aadhaarNumber = (payload.aadhaarNumber || payload.ownerAadharNumber || payload.ownerAadhaarNumber || '').trim();
    const panNumber = (payload.panNumber || payload.ownerPanNumber || '').trim().toUpperCase();
    const gstinNumber = (payload.gstinNumber || payload.gstin || '').trim().toUpperCase();
    const password = payload.password ? String(payload.password).trim() : null;
    const bankId = payload.bankId || null;
    const branchId = payload.branchId || null;

    if (!shopName) {
      throw ApiError.badRequest('Shop Name is required.', ErrorCode.VALIDATION_ERROR);
    }

    if (!ownerName) {
      throw ApiError.badRequest('Shop Owner Name is required.', ErrorCode.VALIDATION_ERROR);
    }

    // Check duplicate email or phone within bank
    const bankFilter = bankId ? { bankId } : {};
    const existingEmail = await MerchantProfile.findOne({ email, ...bankFilter, isDeleted: { $ne: true } });
    if (existingEmail) {
      throw ApiError.conflict(bankId ? 'A Merchant with this email address already exists for this Bank.' : 'A Merchant with this email address already exists.', ErrorCode.VALIDATION_ERROR);
    }

    const existingPhone = await MerchantProfile.findOne({ phoneNumber, ...bankFilter, isDeleted: { $ne: true } });
    if (existingPhone) {
      throw ApiError.conflict(bankId ? 'Customer is already an onboarded Merchant in this Bank. Only 1 Merchant profile is allowed per Bank.' : 'A Merchant with this phone number already exists.', ErrorCode.VALIDATION_ERROR);
    }

    // Process document uploads
    const aadhaarUpload = await this.processFileUpload(files.ownerAadhaar || files.ownerAadhar);
    const panUpload = await this.processFileUpload(files.ownerPan);
    const regCertUpload = await this.processFileUpload(files.shopRegistrationCertificate);
    const gstCertUpload = await this.processFileUpload(files.gstCertificate);

    // 1. Create User login credentials for Merchant Partner
    let merchantUser = null;
    if (phoneNumber) {
      merchantUser = await User.findOne({ phoneNumber, isDeleted: { $ne: true } });
    }
    if (!merchantUser && email) {
      merchantUser = await User.findOne({ email, isDeleted: { $ne: true } });
    }

    const defaultPassword = password || 'Merchant@123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    if (!merchantUser) {
      merchantUser = new User({
        email: email || undefined,
        phoneNumber,
        fullName: ownerName,
        passwordHash,
        role: UserRole.VENDOR,
        userType: UserType.PARTNER,
        profileModel: 'MerchantProfile',
        status: 'ACTIVE',
        createdBy: creatorId
      });
      await merchantUser.save();
    } else {
      merchantUser.fullName = ownerName || merchantUser.fullName;
      if (password) {
        merchantUser.passwordHash = passwordHash;
      }
      if (merchantUser.role !== UserRole.VENDOR && merchantUser.role !== UserRole.MERCHANT) {
        merchantUser.role = UserRole.VENDOR;
      }
      merchantUser.userType = UserType.PARTNER;
      merchantUser.profileModel = 'MerchantProfile';
      if (!merchantUser.phoneNumber && phoneNumber) {
        merchantUser.phoneNumber = phoneNumber;
      }
      if (merchantUser.status !== 'ACTIVE') {
        merchantUser.status = 'ACTIVE';
      }
      await merchantUser.save();
    }

    // 2. Create MerchantProfile
    const merchant = new MerchantProfile({
      userId: merchantUser._id,
      bankId,
      branchId,
      shopName,
      ownerName,
      email,
      phoneNumber,
      aadhaarNumber,
      panNumber,
      gstinNumber,
      documents: {
        ownerAadhaar: aadhaarUpload.url,
        ownerAadhaarKey: aadhaarUpload.key,
        ownerPan: panUpload.url,
        ownerPanKey: panUpload.key,
        shopRegistrationCertificate: regCertUpload.url,
        shopRegistrationCertificateKey: regCertUpload.key,
        gstCertificate: gstCertUpload.url,
        gstCertificateKey: gstCertUpload.key
      },
      status: payload.status ? payload.status.toUpperCase() : 'ACTIVE',
      createdBy: creatorId
    });

    await merchant.save();

    // Link profileId to user
    merchantUser.profileId = merchant._id;
    await merchantUser.save();

    return this.formatMerchantResponse(merchant);
  }

  /**
   * Update existing Merchant
   */
  async updateMerchant(id, payload, files = {}, updaterId) {
    const merchant = await MerchantProfile.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!merchant) {
      throw ApiError.notFound('Merchant not found for update.');
    }

    if (payload.shopName) merchant.shopName = payload.shopName.trim();
    if (payload.ownerName || payload.shopOwnerName) {
      merchant.ownerName = (payload.ownerName || payload.shopOwnerName).trim();
    }
    if (payload.email) merchant.email = payload.email.trim().toLowerCase();
    if (payload.phoneNumber || payload.phone) {
      merchant.phoneNumber = (payload.phoneNumber || payload.phone).trim();
    }

    if (payload.aadhaarNumber !== undefined || payload.ownerAadharNumber !== undefined || payload.ownerAadhaarNumber !== undefined) {
      merchant.aadhaarNumber = (payload.aadhaarNumber || payload.ownerAadharNumber || payload.ownerAadhaarNumber || '').trim();
    }

    if (payload.panNumber !== undefined || payload.ownerPanNumber !== undefined) {
      merchant.panNumber = (payload.panNumber || payload.ownerPanNumber || '').trim().toUpperCase();
    }

    if (payload.gstinNumber !== undefined || payload.gstin !== undefined) {
      merchant.gstinNumber = (payload.gstinNumber || payload.gstin || '').trim().toUpperCase();
    }

    if (payload.status) {
      merchant.status = payload.status.toUpperCase();
    }

    if (payload.password && merchant.userId) {
      const password = String(payload.password).trim();
      if (password.length >= 6) {
        const passwordHash = await bcrypt.hash(password, 10);
        await User.updateOne({ _id: merchant.userId }, { passwordHash, updatedBy: updaterId });
      }
    }

    const docs = merchant.documents || {};

    if (files.ownerAadhaar || files.ownerAadhar) {
      const upload = await this.processFileUpload(files.ownerAadhaar || files.ownerAadhar);
      if (upload.url) {
        docs.ownerAadhaar = upload.url;
        docs.ownerAadhaarKey = upload.key;
      }
    }

    if (files.ownerPan) {
      const upload = await this.processFileUpload(files.ownerPan);
      if (upload.url) {
        docs.ownerPan = upload.url;
        docs.ownerPanKey = upload.key;
      }
    }

    if (files.shopRegistrationCertificate) {
      const upload = await this.processFileUpload(files.shopRegistrationCertificate);
      if (upload.url) {
        docs.shopRegistrationCertificate = upload.url;
        docs.shopRegistrationCertificateKey = upload.key;
      }
    }

    if (files.gstCertificate) {
      const upload = await this.processFileUpload(files.gstCertificate);
      if (upload.url) {
        docs.gstCertificate = upload.url;
        docs.gstCertificateKey = upload.key;
      }
    }

    merchant.documents = docs;
    merchant.updatedBy = updaterId;
    await merchant.save();

    return this.formatMerchantResponse(merchant);
  }

  /**
   * Soft delete Merchant
   */
  async deleteMerchant(id, deleterId) {
    const merchant = await MerchantProfile.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!merchant) {
      throw ApiError.notFound('Merchant not found for deletion.');
    }

    merchant.isDeleted = true;
    merchant.deletedAt = new Date();
    merchant.deletedBy = deleterId;
    await merchant.save();

    if (merchant.userId) {
      await User.updateOne(
        { _id: merchant.userId },
        { isDeleted: true, deletedAt: new Date(), deletedBy: deleterId }
      );
    }

    return { id: merchant._id, message: 'Merchant deleted successfully.' };
  }

  /**
   * List active merchants for dropdown selections
   */
  async listMerchantsDropdown() {
    const merchants = await MerchantProfile.find({ isDeleted: { $ne: true }, status: 'ACTIVE' })
      .select('_id shopName ownerName email phoneNumber gstinNumber')
      .sort({ shopName: 1 })
      .lean();

    return merchants.map(m => ({
      id: m._id,
      merchantId: m._id,
      shopName: m.shopName,
      ownerName: m.ownerName,
      label: `${m.shopName} (${m.ownerName})`,
      phoneNumber: m.phoneNumber,
      email: m.email
    }));
  }
}

export const merchantService = new MerchantService();
