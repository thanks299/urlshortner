/**
 * src/validators/linkValidator.js
 * Express middleware — validates incoming request bodies before they
 * hit the service. Returns structured 400 errors so controllers stay clean.
 */

import validator from 'validator';
import AppError from '../utils/AppError.js';

function _validateNotifyBefore(notifyBefore) {
  if (notifyBefore === undefined || notifyBefore === null || notifyBefore === '') return null;
  const n = Number(notifyBefore);
  if (Number.isNaN(n) || n < 0) return 'notifyBefore must be a non-negative number (minutes).';
  return null;
}

function _validateOriginalUrl(originalUrl) {
  if (!originalUrl || typeof originalUrl !== 'string' || !originalUrl.trim()) {
    return 'originalUrl is required.';
  }
  const trimmed = originalUrl.trim();
  if (!validator.isURL(trimmed, { protocols: ['http', 'https'], require_protocol: true })) {
    return 'Invalid URL. Must start with http:// or https://.';
  }
  return null;
}

function _validateCustomCode(customCode) {
  if (customCode !== undefined && customCode !== null && customCode !== '') {
    const code = String(customCode).trim();
    if (!/^[a-zA-Z0-9_-]{2,30}$/.test(code)) {
      return 'Custom code must be 2–30 alphanumeric chars (- _ allowed).';
    }
  }
  return null;
}

function _validateExpiresAt(expiresAt) {
  if (expiresAt !== undefined && expiresAt !== null && expiresAt !== '') {
    const d = new Date(expiresAt);
    if (Number.isNaN(d.getTime())) {
      return 'Invalid expiresAt. Provide a valid ISO date string.';
    }
    if (d <= new Date()) {
      return 'expiresAt must be in the future.';
    }
  }
  return null;
}

function validateShorten(req, _res, next) {
  const { originalUrl, customCode, expiresAt, notifyBefore } = req.body;

  // originalUrl
  let error = _validateOriginalUrl(originalUrl);
  if (error) return next(new AppError(error, 400));

  const trimmed = originalUrl.trim();

  // customCode
  error = _validateCustomCode(customCode);
  if (error) return next(new AppError(error, 400));

  // expiresAt
  error = _validateExpiresAt(expiresAt);
  if (error) return next(new AppError(error, 400));

  // notifyBefore (minutes before expiry to send notification)
  error = _validateNotifyBefore(notifyBefore);
  if (error) return next(new AppError(error, 400));

  // Sanitise — overwrite with trimmed values
  req.body.originalUrl = trimmed;
  if (customCode) req.body.customCode = String(customCode).trim();
  if (notifyBefore !== undefined && notifyBefore !== null && notifyBefore !== '') {
    req.body.notifyBefore = Number(notifyBefore);
  }

  next();
}

export { validateShorten };