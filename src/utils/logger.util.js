import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { loggerConfig } from '../config/logger.config.js';
import { envConfig } from '../config/env.config.js';

const { combine, timestamp, printf, colorize, json, metadata } = winston.format;

const consoleLogFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `[${timestamp}] ${level}: ${message} ${metaString}`;
});

export const logger = winston.createLogger({
  level: loggerConfig.level,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
    json()
  ),
  transports: [
    new DailyRotateFile({
      filename: `${loggerConfig.directory}/app-combined-%DATE%.log`,
      datePattern: loggerConfig.datePattern,
      zippedArchive: loggerConfig.zippedArchive,
      maxSize: loggerConfig.maxSize,
      maxFiles: loggerConfig.maxFiles,
      level: 'info'
    }),
    new DailyRotateFile({
      filename: `${loggerConfig.directory}/app-error-%DATE%.log`,
      datePattern: loggerConfig.datePattern,
      zippedArchive: loggerConfig.zippedArchive,
      maxSize: loggerConfig.maxSize,
      maxFiles: loggerConfig.maxFiles,
      level: 'error'
    }),
    new DailyRotateFile({
      filename: `${loggerConfig.directory}/app-security-%DATE%.log`,
      datePattern: loggerConfig.datePattern,
      zippedArchive: loggerConfig.zippedArchive,
      maxSize: loggerConfig.maxSize,
      maxFiles: loggerConfig.maxFiles,
      level: 'warn'
    })
  ]
});

// Always add Console transport so stdout/stderr captures logs in docker container & dev environment
logger.add(new winston.transports.Console({
  format: combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    consoleLogFormat
  )
}));

export const stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};
