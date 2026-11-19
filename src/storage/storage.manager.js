import { storageConfig } from '../config/storage.config.js';
import { LocalStorageProvider } from './providers/local.provider.js';
import { S3StorageProvider } from './providers/s3.provider.js';
import { CloudinaryStorageProvider } from './providers/cloudinary.provider.js';
import { logger } from '../utils/logger.util.js';

class StorageManager {
  constructor() {
    this.provider = null;
    this.init();
  }

  init() {
    const { provider, local, s3, cloudinary } = storageConfig;

    logger.info(`STORAGE MANAGER: Initializing storage driver strategy for: [${provider}]`);

    switch (provider.toUpperCase()) {
      case 'LOCAL':
        this.provider = new LocalStorageProvider(local);
        break;
      case 'S3':
        this.provider = new S3StorageProvider(s3);
        break;
      case 'CLOUDINARY':
        this.provider = new CloudinaryStorageProvider(cloudinary);
        break;
      default:
        logger.warn(`STORAGE MANAGER: Strategy [${provider}] unrecognized. Defaulting to local storage.`);
        this.provider = new LocalStorageProvider(local);
    }
  }

  async uploadFile(file, folder) {
    return this.provider.upload(file, folder);
  }

  async deleteFile(filePath) {
    return this.provider.delete(filePath);
  }
}

export const storageManager = new StorageManager();
