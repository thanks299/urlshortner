/**
 * src/middlewares/sanitize.js
 * SECURITY: Prevents NoSQL injection attacks
 * Sanitizes all query parameters and request body values
 */

import mongoSanitize from 'express-mongo-sanitize';

const sanitizeMiddleware = mongoSanitize({
  onSanitize: ({ req, key }) => {
    console.warn(`Data sanitized from ${key}: potentially malicious input detected`);
  },
  replaceWith: '_',  
  allowDots: false, 
});

export default sanitizeMiddleware;
