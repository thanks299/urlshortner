/**
 * src/config/mailer.js
 * Email configuration using Nodemailer
 */

import nodemailer from 'nodemailer';
import logger from './logger.js';

let transporter = null;

/**
 * Initialize email transporter based on environment
 * Supports: Gmail, Outlook, SendGrid, or custom SMTP
 */
function createTransporter() {
  const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';
  
  if (emailProvider === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD, // Use app-specific password
      },
    });
  }
  
  if (emailProvider === 'outlook') {
    return nodemailer.createTransport({
      service: 'outlook',
      auth: {
        user: process.env.OUTLOOK_EMAIL,
        pass: process.env.OUTLOOK_PASSWORD,
      },
    });
  }
  
  if (emailProvider === 'sendgrid') {
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  }
  
  // Default: Generic SMTP
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: Number.parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    } : undefined,
    connectionTimeout: 10000, // 10s timeout instead of default 2min
    greetingTimeout: 10000,
  });
}

/**
 * Initialize mailer (call on app startup)
 */
export async function initMailer() {
  if (!process.env.EMAIL_PROVIDER) {
    logger.warn('EMAIL_PROVIDER not set. Email notifications disabled.');
    return false;
  }
  
  try {
    transporter = createTransporter();
    
    // Verify connection
    await transporter.verify();
    logger.info('✓ Email transporter configured and verified');
    return true;
  } catch (err) {
    logger.error('✗ Failed to initialize email transporter:', err.message);
    transporter = null;
    return false;
  }
}

/**
 * Get transporter instance
 */
export function getTransporter() {
  if (!transporter) {
    logger.error('Email transporter not initialized. Call initMailer() first.');
    return null;
  }
  return transporter;
}

/**
 * Check if email is configured
 */
export function isMailerConfigured() {
  return transporter !== null;
}

export default { initMailer, getTransporter, isMailerConfigured };
