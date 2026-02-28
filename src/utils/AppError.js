/**
 * src/utils/AppError.js
 * Custom error class for operational (expected) errors.
 * Distinguishes between bugs (unexpected) and user/business errors (operational).
 */

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode   = statusCode;
    this.isOperational = true; 
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;