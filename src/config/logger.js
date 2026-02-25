/**
 * src/config/logger.js
 * Centralised Winston logger.
 * Logs to console in dev, to files in production.
 */

import { createLogger, format, transports } from 'winston';

const { combine, timestamp, printf, colorize, errors } = format;

// Custom log entry formatter with toString() method
class LogEntry {
  constructor({ level, message, timestamp, stack }) {
    this.level = level;
    this.message = message;
    this.timestamp = timestamp;
    this.stack = stack;
  }

  toString() {
    return `${this.timestamp} [${this.level}]: ${this.stack || this.message}`;
  }
}

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf((logData) => new LogEntry(logData).toString())
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  format.json()
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports: [
    new transports.Console(),
    ...(process.env.NODE_ENV === 'production'
      ? [
          new transports.File({ filename: 'logs/error.log', level: 'error' }),
          new transports.File({ filename: 'logs/combined.log' }),
        ]
      : []),
  ],
});

export default logger;