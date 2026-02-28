/**
 * src/gateways/cookieGateway.js
 * Cookie management gateway - handles secure cookie operations
 */

import logger from '../config/logger.js';

class CookieGateway {
  /**
   * Set authentication cookie with secure options
   * @param {object} res - Express response object
   * @param {string} sessionId - Session ID to store in cookie
   * @param {number} maxAge - Cookie max age in milliseconds
   */
  setAuthCookie(res, sessionId, maxAge = 5 * 60 * 1000) {
    const cookieOptions = {
      httpOnly: true, // Prevents XSS attacks
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict', // CSRF protection
      maxAge: maxAge, // 5 minutes by default
      path: '/', // Cookie available across entire domain
    };

    res.cookie('sessionId', sessionId, cookieOptions);
    logger.info(`[COOKIE] Set authentication cookie for session ${sessionId.substring(0, 20)}...`);
  }

  /**
   * Clear authentication cookie
   * @param {object} res - Express response object
   */
  clearAuthCookie(res) {
    res.cookie('sessionId', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0, // Expire immediately
      path: '/',
    });
    logger.info('[COOKIE] Cleared authentication cookie');
  }

  /**
   * Get session ID from cookies
   * @param {object} req - Express request object
   * @returns {string|null} - Session ID or null
   */
  getSessionId(req) {
    return req.cookies?.sessionId || null;
  }

  /**
   * Validate cookie structure
   * @param {string} cookie - Cookie value
   * @returns {boolean} - Valid or not
   */
  isValidCookie(cookie) {
    return !!(cookie && typeof cookie === 'string' && cookie.length > 0);
  }
}

export default new CookieGateway();
