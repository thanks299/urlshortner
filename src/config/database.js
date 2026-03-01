/**
 * src/config/database.js
 * MongoDB connection management via Mongoose.
 * Handles connect, disconnect, and graceful shutdown.
 */

import mongoose from 'mongoose';
import logger from './logger.js';

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  (process.env.NODE_ENV !== 'production'
    ? 'mongodb://127.0.0.1:27017/url-shortener'
    : null);

const OPTIONS = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

async function connect() {
  if (!MONGO_URI) {
    const errorMsg = 'MONGO_URI is not defined. Please set it in environment variables.';
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }
  try {
    await mongoose.connect(MONGO_URI, OPTIONS);
    logger.info(`MongoDB connected → ${MONGO_URI}`);
  } catch (err) {
    logger.error('MongoDB connection failed:', err.message);
    throw err;
  }
}

async function disconnect() {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected.');
}

// Graceful shutdown on SIGINT / SIGTERM
process.on('SIGINT',  () => disconnect().then(() => process.exit(0)));
process.on('SIGTERM', () => disconnect().then(() => process.exit(0)));

export { connect, disconnect, mongoose };