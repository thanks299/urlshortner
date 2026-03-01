/**
 * src/middlewares/auth.js
 * Authentication middleware — verifies JWT tokens.
 */

import { verifyToken } from '../utils/jwt.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import User from '../models/User.js';

export const protect = catchAsync(async (req, res, next) => {
  let token;

  // Extract JWT token from Authorization header
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(
      new AppError('You must be logged in to access this resource', 401)
    );
  }

  try {
    const decoded = verifyToken(token);
    const foundUser = await User.findById(decoded.id);

    if (!foundUser) {
      return next(
        new AppError('User not found', 404)
      );
    }

    req.user = foundUser;
    return next();
  } catch (err) {
    console.error('Token verification error:', err.message);
    return next(
      new AppError('Invalid or expired token', 401)
    );
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
