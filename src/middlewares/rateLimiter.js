/**
 * src/middlewares/rateLimiter.js
 * Per-IP rate limiting on all /api/* routes.
 */

import rateLimit from 'express-rate-limit';

const rateLimiter = rateLimit({
  windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 min
  max:      Number.parseInt(process.env.RATE_LIMIT_MAX, 10)        || 100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
});

export default rateLimiter;