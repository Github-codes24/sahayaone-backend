import './env.config.js';

export const loggerConfig = Object.freeze({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  directory: './logs',
  filename: 'sahayaone-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  consoleFormat: 'colorize'
});
