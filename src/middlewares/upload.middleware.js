import multer from 'multer';
import path from 'path';
import { ApiError } from '../common/api.error.js';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/octet-stream'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid image file type. Only JPEG, JPG, PNG, and WEBP are supported.'), false);
  }
};

const documentFileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf', 'application/octet-stream'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, JPG, PNG, WEBP, and PDF documents are supported.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit
  }
});

const docUpload = multer({
  storage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit
  }
});

export const uploadSingleImage = (fieldName) => {
  const uploadMiddleware = upload.single(fieldName);

  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return next(ApiError.badRequest('Image file size exceeds the 25MB limit.'));
          }
          return next(ApiError.badRequest(`Image upload error: ${err.message}`));
        }
        return next(ApiError.badRequest(err.message));
      }
      next();
    });
  };
};

export const uploadBankDocuments = (req, res, next) => {
  const uploadMiddleware = docUpload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'bankLogo', maxCount: 1 },
    { name: 'registrationCertificate', maxCount: 1 },
    { name: 'companyPan', maxCount: 1 },
    { name: 'boardResolution', maxCount: 1 },
    { name: 'gstDeclaration', maxCount: 1 },
    { name: 'directorKyc', maxCount: 1 },
    { name: 'cancelledCheque', maxCount: 1 }
  ]);

  uploadMiddleware(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(ApiError.badRequest('Document file size exceeds the 25MB limit.'));
        }
        return next(ApiError.badRequest(`Document upload error: ${err.message}`));
      }
      return next(ApiError.badRequest(err.message));
    }
    next();
  });
};

export const uploadMerchantDocuments = (req, res, next) => {
  const uploadMiddleware = docUpload.any();

  uploadMiddleware(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(ApiError.badRequest('Document file size exceeds the 25MB limit.'));
        }
        return next(ApiError.badRequest(`Document upload error: ${err.message}`));
      }
      return next(ApiError.badRequest(err.message));
    }
    next();
  });
};

export const uploadReceiptDocument = (req, res, next) => {
  const uploadMiddleware = docUpload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'receiptImage', maxCount: 1 },
    { name: 'document', maxCount: 1 }
  ]);

  uploadMiddleware(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(ApiError.badRequest('Receipt file size exceeds the 25MB limit.'));
        }
        return next(ApiError.badRequest(`Receipt upload error: ${err.message}`));
      }
      return next(ApiError.badRequest(err.message));
    }
    if (!req.file && req.files) {
      const fileArr = req.files.file || req.files.image || req.files.receiptImage || req.files.document;
      if (fileArr && fileArr.length > 0) {
        req.file = fileArr[0];
      }
    }
    next();
  });
};
