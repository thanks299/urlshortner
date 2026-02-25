/**
 * src/middlewares/notFound.js
 * Catch-all for unmatched routes — returns 404 JSON.
 */

import AppError from '../utils/AppError.js';

function notFound(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

export default notFound;