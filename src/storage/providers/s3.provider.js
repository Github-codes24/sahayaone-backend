import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../../utils/logger.util.js';
import path from 'path';

export class S3StorageProvider {
  constructor(config) {
    this.bucketName = config.bucketName;
    this.region = config.region;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.endpoint = config.endpoint;
    this.publicUrl = config.publicUrl;

    this.s3Client = new S3Client({
      region: this.region,
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  async upload(file, folder = 'banners') {
    const originalname = file.originalname || 'upload.jpg';
    const mimetype = file.mimetype || 'image/jpeg';
    const buffer = file.buffer;

    return this.uploadBuffer(buffer, originalname, mimetype, folder);
  }

  async uploadBuffer(buffer, originalname = 'upload.jpg', mimetype = 'image/jpeg', folder = 'banners') {
    logger.info(`STORAGE CLIENT: S3 Upload triggered for file: ${originalname} into folder: ${folder}`);
    const ext = path.extname(originalname) || '.jpg';
    const key = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    try {
      const putParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      };

      try {
        const commandWithAcl = new PutObjectCommand({ ...putParams, ACL: 'public-read' });
        await this.s3Client.send(commandWithAcl);
      } catch (aclError) {
        logger.warn(`STORAGE CLIENT S3: ACL public-read failed (${aclError.message}), retrying without ACL...`);
        const commandNoAcl = new PutObjectCommand(putParams);
        await this.s3Client.send(commandNoAcl);
      }

      const cleanPublicUrl = (this.publicUrl || '').replace(/\/+$/, '');
      const url = `${cleanPublicUrl}/${key}`;

      return {
        success: true,
        provider: 'S3',
        filePath: key,
        fileUrl: url,
        url,
        key,
        originalName: originalname,
        mimeType: mimetype,
        size: buffer.length
      };
    } catch (error) {
      logger.error(`STORAGE CLIENT S3 EXCEPTION: Upload failed: ${error.message}`);
      throw new Error(`S3 file upload pipeline failed: ${error.message}`);
    }
  }

  async delete(filePath) {
    logger.info(`STORAGE CLIENT: S3 Delete triggered for path: ${filePath}`);
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      });

      await this.s3Client.send(command);
      return { success: true };
    } catch (error) {
      logger.error(`STORAGE CLIENT S3 EXCEPTION: Delete failed: ${error.message}`);
      throw new Error(`S3 file delete pipeline failed: ${error.message}`);
    }
  }
}

