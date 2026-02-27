/**
 * src/routes/auth.js
 * Authentication routes — register, login, logout.
 */

import express from 'express';
import { register, login, logout } from '../controllers/authController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.post('/logout', protect, logout);

export default router;
