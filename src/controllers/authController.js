/**
 * src/controllers/authController.js
 * Authentication controller — handles user registration and login with session & cookies.
 */

import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { signToken } from '../utils/jwt.js';
import sessionGateway from '../gateways/sessionGateway.js';
import cookieGateway from '../gateways/cookieGateway.js';

export const register = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return next(new AppError('Email and password are required', 400));
  }

  if (password.length < 6) {
    return next(new AppError('Password must be at least 6 characters', 400));
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return next(new AppError('Email is already registered', 400));
  }

  // Create new user
  const user = await User.create({ email: email.toLowerCase(), password });

  // Generate JWT token (for backward compatibility if needed)
  const token = signToken(user._id);

  // Create session in Redis
  const sessionId = await sessionGateway.createSession(user._id.toString(), {
    email: user.email,
    registeredAt: new Date().toISOString(),
  });

  // Set authentication cookie with session ID
  cookieGateway.setAuthCookie(res, sessionId);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    token, // Still return for backward compatibility
    user: {
      id: user._id,
      email: user.email,
    },
  });
});

export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return next(new AppError('Email and password are required', 400));
  }

  // Check if user exists and get password field
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+password'
  );

  if (!user) {
    console.log(`[AUTH] Login failed: User not found for email: ${email}`);
    return next(new AppError('Invalid email or password', 401));
  }

  // Compare passwords
  const isPasswordCorrect = await user.matchPassword(password);

  if (!isPasswordCorrect) {
    console.log(`[AUTH] Login failed: Incorrect password for email: ${email}`);
    return next(new AppError('Invalid email or password', 401));
  }
  
  console.log(`[AUTH] Login successful for: ${email}`);

  // Generate JWT token (for backward compatibility)
  const token = signToken(user._id);

  // Create session in Redis
  const sessionId = await sessionGateway.createSession(user._id.toString(), {
    email: user.email,
    loginAt: new Date().toISOString(),
  });

  // Set authentication cookie with session ID
  cookieGateway.setAuthCookie(res, sessionId);

  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    token, // Still return for backward compatibility
    user: {
      id: user._id,
      email: user.email,
    },
  });
});

export const logout = catchAsync(async (req, res) => {
  // Get session ID from cookie and destroy it
  const sessionId = cookieGateway.getSessionId(req);
  if (sessionId) {
    await sessionGateway.destroySession(sessionId);
  }

  // Clear authentication cookie
  cookieGateway.clearAuthCookie(res);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});
