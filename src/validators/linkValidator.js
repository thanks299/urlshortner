/**
 * src/validators/linkValidator.js
 * Express middleware — validates incoming request bodies before they
 * hit the service. Returns structured 400 errors so controllers stay clean.
 */

import validator from 'validator';
import AppError from '../utils/AppError.js';

function validateShorten(req, _res, next) {
  const { originalUrl, customCode, expiresAt } = req.body;

  // originalUrl
  if (!originalUrl || typeof originalUrl !== 'string' || !originalUrl.trim()) {
    return next(new AppError('originalUrl is required.', 400));
  }

  const trimmed = originalUrl.trim();
  if (!validator.isURL(trimmed, { protocols: ['http', 'https'], require_protocol: true })) {
    return next(new AppError('Invalid URL. Must start with http:// or https://.', 400));
  }

  // customCode
  if (customCode !== undefined && customCode !== null && customCode !== '') {
    const code = String(customCode).trim();
    if (!/^[a-zA-Z0-9_-]{2,30}$/.test(code)) {
      return next(new AppError('Custom code must be 2–30 alphanumeric chars (- _ allowed).', 400));
    }
  }

  // expiresAt
  if (expiresAt !== undefined && expiresAt !== null && expiresAt !== '') {
    const d = new Date(expiresAt);
    if (isNaN(d.getTime())) {
      return next(new AppError('Invalid expiresAt. Provide a valid ISO date string.', 400));
    }
    if (d <= new Date()) {
      return next(new AppError('expiresAt must be in the future.', 400));
    }
  }

  // Sanitise — overwrite with trimmed values
  req.body.originalUrl = trimmed;
  if (customCode) req.body.customCode = String(customCode).trim();

  next();
}

export { validateShorten };