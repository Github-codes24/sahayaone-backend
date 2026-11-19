import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger.util.js';

export class LocalStorageProvider {
  constructor(config) {
    this.uploadDir = config.uploadDir || './storage/uploads';
    this.init();
  }

  init() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      logger.info(`STORAGE PROVIDER: Created local uploads folder: ${this.uploadDir}`);
    }
  }

  async upload(file, folder = '') {
    try {
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
      const targetDir = folder ? path.join(this.uploadDir, folder) : this.uploadDir;
      
      if (folder && !fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      const targetPath = path.join(targetDir, fileName);

      await fs.promises.writeFile(targetPath, file.buffer);
      
      const fileUrl = folder ? `/public/uploads/${folder}/${fileName}` : `/public/uploads/${fileName}`;
      
      return {
        success: true,
        provider: 'LOCAL',
        filePath: targetPath,
        fileUrl,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size
      };
    } catch (error) {
      logger.error(`STORAGE EXCEPTION: Local write failed: ${error.message}`);
      throw new Error(`Local file write pipeline failed: ${error.message}`);
    }
  }

  async delete(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      return { success: true };
    } catch (error) {
      logger.error(`STORAGE EXCEPTION: Local delete failed: ${error.message}`);
      throw new Error(`Local file delete pipeline failed: ${error.message}`);
    }
  }
}
