import { LoanApplication } from '../../../../models/loan-application.model.js';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import { Variant } from '../../../../models/variant.model.js';
import { Product } from '../../../../models/product.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { storageManager } from '../../../../storage/storage.manager.js';
import { logger } from '../../../../utils/logger.util.js';
import { customerCatalogService } from '../../catalog/services/catalog.service.js';
import { processDocumentUpload } from '../../../employee/leads/services/leads.service.js';

const LOAN_CATEGORIES = [
  {
    name: 'Mobiles on EMI',
    formSchema: []
  },
  {
    name: 'Electronics on EMI',
    formSchema: []
  },
  {
    name: 'Two Wheeler Loan',
    formSchema: [
      { name: 'employmentType', label: 'Employment Type', type: 'SELECT', required: true, options: ['Salaried', 'Self-Employed'] },
      { name: 'monthlyIncome', label: 'Monthly Income', type: 'NUMBER', required: true, placeholder: 'e.g., 25000' }
    ]
  },
  {
    name: 'Used Car Loan',
    formSchema: [
      { name: 'employmentType', label: 'Employment Type', type: 'SELECT', required: true, options: ['Salaried', 'Self-Employed'] },
      { name: 'monthlyIncome', label: 'Monthly Income', type: 'NUMBER', required: true, placeholder: 'e.g., 40000' }
    ]
  },
  {
    name: 'New Car Loan',
    formSchema: [
      { name: 'employmentType', label: 'Employment Type', type: 'SELECT', required: true, options: ['Salaried', 'Self-Employed'] },
      { name: 'monthlyIncome', label: 'Monthly Income', type: 'NUMBER', required: true, placeholder: 'e.g., 50000' }
    ]
  },
  {
    name: 'Tractor Finance',
    formSchema: [
      { name: 'landOwnership', label: 'Agricultural Land Owned (Acres)', type: 'NUMBER', required: true, placeholder: 'e.g., 5' }
    ]
  },
  {
    name: 'Personal Loan',
    formSchema: [
      { name: 'employmentType', label: 'Employment Type', type: 'SELECT', required: true, options: ['Salaried', 'Self-Employed'] },
      { name: 'monthlyIncome', label: 'Monthly Income', type: 'NUMBER', required: true, placeholder: 'e.g., 30000' },
      { name: 'companyName', label: 'Company Name', type: 'TEXT', required: true, placeholder: 'e.g., Sahayaone Corp' }
    ]
  },
  {
    name: 'Home Loan',
    formSchema: [
      { name: 'monthlyIncome', label: 'Monthly Income', type: 'NUMBER', required: true, placeholder: 'e.g., 60000' },
      { name: 'propertyValue', label: 'Property Agreement Value', type: 'NUMBER', required: true, placeholder: 'e.g., 3500000' }
    ]
  },
  {
    name: 'Gold Loan',
    formSchema: [
      { name: 'goldWeightGrams', label: 'Gold Weight (in Grams)', type: 'NUMBER', required: true, placeholder: 'e.g., 25' }
    ]
  }
];

const parseBase64ToMulterFile = (base64String, fieldName, customerId) => {
  const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw ApiError.badRequest('Invalid document image format. Base64 payload required.', ErrorCode.VALIDATION_ERROR);
  }

  const mimeType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  const ext = mimeType.split('/')[1] || 'jpg';
  
  return {
    originalname: `${fieldName}_${customerId}.${ext}`,
    buffer,
    mimetype: mimeType,
    size: buffer.length
  };
};

export class LoanApplicationService {
  /**
   * Starts a new draft loan application
   */
  async createApplication(customerId, variantIds) {
    // 1. Verify variants exist
    const variants = await Variant.find({ _id: { $in: variantIds }, isDeleted: false });
    if (variants.length !== variantIds.length) {
      throw ApiError.badRequest('One or more selected product variants do not exist.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    // 2. Clear any existing DRAFT applications for this customer
    await LoanApplication.deleteMany({ customerId, status: 'DRAFT' });

    // 3. Generate unique applicationId: APPL + 8 random digits
    const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
    const applicationId = `APPL${randomDigits}`;

    // 4. Create new draft application
    const application = await LoanApplication.create({
      applicationId,
      customerId,
      selectedVariants: variantIds,
      status: 'DRAFT'
    });

    // 5. Check if user already has verified profile KYC
    const profile = await CustomerProfile.findOne({ userId: customerId });
    const kycAlreadyVerified = profile ? profile.kycStatus === 'VERIFIED' : false;

    return {
      id: application._id,
      applicationId: application.applicationId,
      kycAlreadyVerified,
      activeAddress: profile?.activeAddress || null
    };
  }

  /**
   * Saves personal details and triggers simulated Aadhaar OTP verification
   */
  async submitPersonalDetails(applicationId, customerId, payload) {
    const application = await LoanApplication.findOne({ _id: applicationId, customerId, status: 'DRAFT' });
    if (!application) {
      throw ApiError.notFound('Draft loan application not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const profile = await CustomerProfile.findOne({ userId: customerId });
    if (!profile) {
      throw ApiError.notFound('Customer profile records not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (profile.kycStatus === 'VERIFIED') {
      return {
        success: true,
        message: 'Identity is already verified. Please confirm your residential address.',
        kycAlreadyVerified: true,
        activeAddress: profile.activeAddress,
        panUrl: profile.panImage,
        aadhaarUrl: profile.aadhaarImage
      };
    }

    // 1. Identify application loan category dynamically
    const firstVariant = await Variant.findById(application.selectedVariants[0]).populate('productId');
    const product = firstVariant?.productId;
    if (product) {
      const matchedCategory = LOAN_CATEGORIES.find(c => c.name === product.category);

      // Perform dynamic formSchema validation if extra details were provided
      if (matchedCategory && matchedCategory.formSchema.length > 0) {
        const extraDetails = payload.extraDetails || {};
        const validationErrors = [];

        for (const rule of matchedCategory.formSchema) {
          const value = extraDetails[rule.name];

          if (rule.required && (value === undefined || value === null || value === '')) {
            validationErrors.push({
              field: `extraDetails.${rule.name}`,
              message: `${rule.label} is required`,
              location: 'body'
            });
            continue;
          }

          if (value !== undefined && value !== null && value !== '') {
            if (rule.type === 'NUMBER' && isNaN(Number(value))) {
              validationErrors.push({
                field: `extraDetails.${rule.name}`,
                message: `${rule.label} must be a valid number`,
                location: 'body'
              });
            }
            if (rule.type === 'SELECT' && !rule.options.includes(value)) {
              validationErrors.push({
                field: `extraDetails.${rule.name}`,
                message: `${rule.label} must be one of: ${rule.options.join(', ')}`,
                location: 'body'
              });
            }
          }
        }

        if (validationErrors.length > 0) {
          throw ApiError.custom(422, 'Invalid request payload format', ErrorCode.VALIDATION_ERROR, validationErrors);
        }
      }
    }

    // 2. Upload document images to storage manager (supports S3, Local, or Cloudinary)
    const rawPan = payload.panImage || payload.panCardUrl || payload.panCardImage || payload.pan;
    const rawAadhaar = payload.aadhaarImage || payload.aadhaarCardUrl || payload.aadhaarCardImage || payload.aadhaar;
    const rawSig = payload.signatureImage || payload.digitalSignature || payload.signature;

    const panImageUrl = await processDocumentUpload(rawPan, 'pan_card', customerId, 'customers');
    const aadhaarImageUrl = await processDocumentUpload(rawAadhaar, 'aadhaar_card', customerId, 'customers');
    const signatureUrl = await processDocumentUpload(rawSig, 'signature', customerId, 'customers');

    // 3. Update customer profile details inside a transaction-like wrapper
    try {
      /*
      // =========================================================================
      // FUTURE IMPLEMENTATION: Government KYC Verification APIs (NSDL & UIDAI)
      // =========================================================================
      // 1. Verify PAN against NSDL Database
      const nsdlPanVerifyUrl = 'https://api.govt.in/nsdl/pan/verify';
      const panResponse = await axios.post(
        nsdlPanVerifyUrl,
        { panNumber: payload.panNumber, expectedName: payload.fullName },
        { headers: { 'Authorization': `Bearer ${process.env.GOVT_API_KEY}` } }
      );
      if (!panResponse.data.isValid) {
        throw ApiError.badRequest('PAN number does not match government records.', ErrorCode.KYC_VERIFICATION_FAILED);
      }

      // 2. Verify Aadhaar against UIDAI Database
      const uidaiVerifyUrl = 'https://api.govt.in/uidai/aadhaar/verify';
      const aadhaarResponse = await axios.post(
        uidaiVerifyUrl,
        { aadhaarNumber: payload.aadhaarNumber },
        { headers: { 'Authorization': `Bearer ${process.env.GOVT_API_KEY}` } }
      );
      if (!aadhaarResponse.data.isValid) {
        throw ApiError.badRequest('Aadhaar number is invalid or not registered.', ErrorCode.KYC_VERIFICATION_FAILED);
      }
      // =========================================================================
      */

      const oldPanImageKey = profile.panImageKey;
      const oldAadhaarImageKey = profile.aadhaarImageKey;

      const nameParts = payload.fullName.trim().split(/\s+/);
      profile.firstName = nameParts[0];
      profile.lastName = nameParts.slice(1).join(' ') || 'Customer';
      profile.panNumber = payload.panNumber.toUpperCase();
      profile.aadhaarNumber = payload.aadhaarNumber;
      profile.gender = payload.gender;
      profile.dob = new Date(payload.dob);
      profile.currentPinCode = payload.currentPinCode;
      
      // Store the storage paths and URLs
      profile.panImage = panUploadResult.fileUrl;
      profile.panImageKey = panUploadResult.filePath;
      profile.aadhaarImage = aadhaarUploadResult.fileUrl;
      profile.aadhaarImageKey = aadhaarUploadResult.filePath;
      profile.kycStatus = 'SUBMITTED';

      await profile.save();

      // Clean up previous uploaded files from cloud to prevent orphans (One identity, one active set of scans)
      if (oldPanImageKey && oldPanImageKey !== panUploadResult.filePath) {
        storageManager.deleteFile(oldPanImageKey).catch(err => {
          logger.error(`STORAGE MANAGER ERROR: Failed to delete old PAN image: ${err.message}`);
        });
      }
      if (oldAadhaarImageKey && oldAadhaarImageKey !== aadhaarUploadResult.filePath) {
        storageManager.deleteFile(oldAadhaarImageKey).catch(err => {
          logger.error(`STORAGE MANAGER ERROR: Failed to delete old Aadhaar image: ${err.message}`);
        });
      }
    } catch (dbError) {
      // ROLLBACK: Delete newly uploaded files to prevent orphan/leaked images
      logger.warn(`KYC SAVE ERROR: Database write failed. Rolling back uploaded files...`);
      if (panUploadResult?.filePath) await storageManager.deleteFile(panUploadResult.filePath);
      if (aadhaarUploadResult?.filePath) await storageManager.deleteFile(aadhaarUploadResult.filePath);
      throw dbError;
    }

    // 4. Trigger simulated Aadhaar OTP verification transaction
    const transactionId = `txn_aadhaar_${Math.floor(100000 + Math.random() * 900000)}`;
    logger.info(`THIRD-PARTY API MOCK: OTP code [123456] dispatched for Aadhaar [${payload.aadhaarNumber}]. Txn ID: [${transactionId}]`);

    return {
      success: true,
      transactionId,
      message: 'A verification code has been dispatched to your Aadhaar-linked phone number.',
      kycAlreadyVerified: false,
      panUrl: profile.panImage,
      aadhaarUrl: profile.aadhaarImage
    };
  }

  /**
   * Verifies Aadhaar OTP and fetches residential address from simulated UIDAI server
   */
  async verifyAadhaarOtp(applicationId, customerId, transactionId, otp) {
    const application = await LoanApplication.findOne({ _id: applicationId, customerId, status: 'DRAFT' });
    if (!application) {
      throw ApiError.notFound('Draft loan application not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const profile = await CustomerProfile.findOne({ userId: customerId });
    if (!profile) {
      throw ApiError.notFound('Customer profile records not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    // 1. Verify OTP code
    if (otp !== '123456') {
      throw ApiError.badRequest('The verification code is incorrect.', ErrorCode.OTP_INVALID);
    }

    // 2. Fetch mock residential address
    const mockAddressLine = 'Pimpri Chinchwad, Pune, 411061';
    
    profile.activeAddress = {
      addressLine: mockAddressLine,
      pinCode: '411061'
    };

    // Prevent duplicating identical address entry in history
    const hasAddressInHistory = profile.addressHistory.some(h => h.addressLine === mockAddressLine);
    if (!hasAddressInHistory) {
      profile.addressHistory.push({
        addressLine: mockAddressLine,
        pinCode: '411061',
        verifiedAt: new Date()
      });
    }

    profile.kycStatus = 'VERIFIED';
    await profile.save();

    return {
      success: true,
      activeAddress: profile.activeAddress
    };
  }

  /**
   * Re-triggers simulated verification OTP to fetch a fresh residential address
   */
  async triggerAddressOtp(applicationId, customerId) {
    const application = await LoanApplication.findOne({ _id: applicationId, customerId, status: 'DRAFT' });
    if (!application) {
      throw ApiError.notFound('Draft loan application not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const profile = await CustomerProfile.findOne({ userId: customerId });
    if (!profile) {
      throw ApiError.notFound('Customer profile records not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const transactionId = `txn_addr_${Math.floor(100000 + Math.random() * 900000)}`;
    logger.info(`THIRD-PARTY API MOCK: Address update OTP code [123456] dispatched for Aadhaar [${profile.aadhaarNumber}]. Txn ID: [${transactionId}]`);

    return {
      success: true,
      transactionId
    };
  }

  /**
   * Verifies OTP and fetches new address coordinates
   */
  async verifyAddressOtp(applicationId, customerId, transactionId, otp) {
    const application = await LoanApplication.findOne({ _id: applicationId, customerId, status: 'DRAFT' });
    if (!application) {
      throw ApiError.notFound('Draft loan application not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const profile = await CustomerProfile.findOne({ userId: customerId });
    if (!profile) {
      throw ApiError.notFound('Customer profile records not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (otp !== '123456') {
      throw ApiError.badRequest('The verification code is incorrect.', ErrorCode.OTP_INVALID);
    }

    // Fetch updated mock address
    const updatedAddressLine = 'Baner, Pune, 411045';

    profile.activeAddress = {
      addressLine: updatedAddressLine,
      pinCode: '411045'
    };

    profile.addressHistory.push({
      addressLine: updatedAddressLine,
      pinCode: '411045',
      verifiedAt: new Date()
    });

    await profile.save();

    return {
      success: true,
      activeAddress: profile.activeAddress
    };
  }

  /**
   * Finalizes and locks the loan application
   */
  async submitApplication(applicationId, customerId) {
    const application = await LoanApplication.findOne({ _id: applicationId, customerId, status: 'DRAFT' });
    if (!application) {
      throw ApiError.notFound('Draft loan application not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const profile = await CustomerProfile.findOne({ userId: customerId });
    if (!profile || profile.kycStatus !== 'VERIFIED') {
      throw ApiError.forbidden('KYC identity verification is required before final submission.', ErrorCode.AUTH_FORBIDDEN);
    }

    // Capture snapshot of KYC data
    application.kycDetailsAtSubmit = profile.toObject();
    application.status = 'SUBMITTED';
    application.submittedAt = new Date();
    await application.save();

    logger.info(`APPLICATION SUBMITTED: Closed application ${application.applicationId} for customer ${customerId}`);

    return {
      success: true,
      applicationId: application.applicationId
    };
  }
}

export const loanApplicationService = new LoanApplicationService();
