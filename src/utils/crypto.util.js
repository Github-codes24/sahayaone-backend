import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

export const cryptoUtil = {
  hash: async (plainText) => {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(plainText, salt);
  },

  compare: async (plainText, hash) => {
    return bcrypt.compare(plainText, hash);
  },

  encrypt: (text, secretKeyHex) => {
    try {
      const key = Buffer.from(secretKeyHex, 'hex');
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  },

  decrypt: (encryptedData, secretKeyHex) => {
    try {
      const parts = encryptedData.split(':');
      const iv = Buffer.from(parts.shift(), 'hex');
      const encryptedText = Buffer.from(parts.join(':'), 'hex');
      const key = Buffer.from(secretKeyHex, 'hex');
      
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }
};
