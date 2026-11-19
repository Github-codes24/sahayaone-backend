import './env.config.js';

export const databaseConfig = Object.freeze({
  uri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sahayaone_db',
  options: {
    maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '100', 10),
    minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || '10', 10),
    autoIndex: process.env.MONGO_AUTO_INDEX === 'true',
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 5000,
    family: 4
  }
});
