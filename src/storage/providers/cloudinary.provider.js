import { v2 as cloudinary } from 'cloudinary';
import { logger } from '../../utils/logger.util.js';

export class CloudinaryStorageProvider {
  constructor(config) {
    this.cloudName = config.cloudName;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;

    // Configure Cloudinary SDK instance
    cloudinary.config({
      cloud_name: this.cloudName,
      api_key: this.apiKey,
      api_secret: this.apiSecret
    });
  }

  /**
   * Uploads file buffer directly to Cloudinary using streams
   * @param {Object} file - Multer memory storage file object
   * @param {String} folder - Cloudinary folder path
   */
  async upload(file, folder = 'banners') {
    let targetFolder = folder;
    if (!targetFolder.startsWith('sahayaone/')) {
      targetFolder = `sahayaone/${targetFolder}`;
    }

    logger.info(`STORAGE CLIENT: Initiating live Cloudinary upload for file: ${file.originalname} into folder: ${targetFolder}`);

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: targetFolder,
          resource_type: 'auto'
        },
        (error, result) => {
          if (error) {
            logger.error(`STORAGE CLIENT ERROR: Cloudinary live upload failed: ${error.message}`);
            return reject(error);
          }

          logger.info(`STORAGE CLIENT: Live upload successful. Public ID: ${result.public_id}`);
          resolve({
            success: true,
            provider: 'CLOUDINARY',
            filePath: result.public_id,
            fileUrl: result.secure_url,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size
          });
        }
      );

      // Write buffer to stream
      stream.end(file.buffer);
    });
  }

  /**
   * Deletes asset from Cloudinary using public ID key
   * @param {String} filePath - The public ID key stored in database
   */
  async delete(filePath) {
    logger.info(`STORAGE CLIENT: Initiating live Cloudinary delete for path: ${filePath}`);

    try {
      const result = await cloudinary.uploader.destroy(filePath);
      logger.info(`STORAGE CLIENT: Cloudinary delete response: ${result.result}`);
      return { success: result.result === 'ok' };
    } catch (error) {
      logger.error(`STORAGE CLIENT ERROR: Cloudinary live deletion failed: ${error.message}`);
      throw error;
    }
  }
}
