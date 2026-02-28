/**
 * src/middlewares/auth.js
 * Authentication middleware — verifies sessions and JWT tokens.
 */

import { verifyToken } from '../utils/jwt.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import User from '../models/User.js';
import sessionGateway from '../gateways/sessionGateway.js';
import cookieGateway from '../gateways/cookieGateway.js';

export const protect = catchAsync(async (req, res, next) => {
  let sessionId = null;

  // Method 1: Check session from cookies (Primary method)
  sessionId = cookieGateway.getSessionId(req);
  if (sessionId) {
    const sessionData = await sessionGateway.validateSession(sessionId);
    
    if (sessionData) {
      // Refresh session on each request
      await sessionGateway.refreshSession(sessionId);
      
      // Get user from database
      const foundUser = await User.findById(sessionData.userId);
      if (foundUser) {
        req.user = foundUser;
        req.sessionId = sessionId;
        return next();
      }
    }
  }

  // Method 2: Fall back to JWT token (for backward compatibility)
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = verifyToken(token);
      const foundUser = await User.findById(decoded.id);
      
      if (foundUser) {
        req.user = foundUser;
        
        // Optionally create a session from valid JWT
        if (!sessionId) {
          const newSessionId = await sessionGateway.createSession(foundUser._id.toString(), {
            email: foundUser.email,
            source: 'jwt',
          });
          cookieGateway.setAuthCookie(res, newSessionId);
          req.sessionId = newSessionId;
        }
        
        return next();
      }
    } catch (err) {
      console.error('Token verification error:', err.message);
    }
  }

  // No valid session or token found
  return next(
    new AppError('You must be logged in to access this resource', 401)
  );
});

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          'You do not have permission to perform this action',
          403
        )
      );
    }
    next();
  };
};
