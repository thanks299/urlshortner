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
    console.log('Using Gmail Email:', process.env.GMAIL_EMAIL);
    console.log('App Password Loaded:', !!process.env.GMAIL_APP_PASSWORD);
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD,
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
  
  // Default: Generic SMTP
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: Number.parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  });
}

export async function initMailer() {
  if (!process.env.EMAIL_PROVIDER) {
    logger.warn('EMAIL_PROVIDER not set. Email notifications disabled.');
    return false;
  }
  
  try {
    transporter = createTransporter();
    
    try {
      await transporter.verify();
      logger.info('✓ Email transporter configured and verified');
    } catch (verifyErr) {
      logger.warn(`⚠ Email transporter verify failed: ${verifyErr.message}`);
    }
    return true;
  } catch (err) {
    logger.error('✗ Failed to create email transporter:', err.message);
    transporter = null;
    return false;
  }
}

export function getTransporter() {
  if (!transporter) {
    logger.error('Email transporter not initialized. Call initMailer() first.');
    return null;
  }
  return transporter;
}

export function isMailerConfigured() {
  return transporter !== null;
}

export default { initMailer, getTransporter, isMailerConfigured };
