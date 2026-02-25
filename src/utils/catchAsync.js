/**
 * src/utils/catchAsync.js
 * Wraps async route handlers to forward errors to Express errorHandler.
 * Eliminates try/catch boilerplate in controllers.
 */

const catchAsync = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export default catchAsync;
