/**
 * src/middlewares/errorHandler.js
 * Global Express error handler — converts AppError / Mongoose errors to JSON.
 */

import logger from '../config/logger.js';
import AppError from '../utils/AppError.js';

const errorHandler = (err, _req, res, _next) => {
  let error = { ...err, message: err.message };

  // ── Mongoose: CastError (bad ObjectId) ──────────────────────────────────────
  if (err.name === 'CastError') {
    error = new AppError(`Invalid ${err.path}: ${err.value}`, 400);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = new AppError(`Duplicate value for ${field}. Please use a different value.`, 409);
  }

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message).join(', ');
    error = new AppError(messages, 400);
  }

  if (!error.isOperational) {
    logger.error('UNHANDLED ERROR:', err);
  }

  const statusCode = error.statusCode || 500;
  const message    = error.isOperational ? error.message : 'Internal server error.';

  res.status(statusCode).json({
    success: false,
    error:   message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default errorHandler;