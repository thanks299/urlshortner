/**
 * src/middlewares/auth.js
 * Authentication middleware — verifies JWT tokens.
 */

import { verifyToken } from '../utils/jwt.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import User from '../models/User.js';

export const protect = catchAsync(async (req, res, next) => {
  // Get token from header
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(
      new AppError('You must be logged in to access this resource', 401)
    );
  }

  try {
    // Verify token
    const decoded = verifyToken(token);

    // Get user from token
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('User not found', 401));
    }

    // Grant access to protected route
    req.user = user;
    next();
  } catch (err) {
    return next(new AppError('Invalid or expired token', 401));
  }
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
