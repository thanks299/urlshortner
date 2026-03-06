/**
 * src/services/emailService.js
 * Email sending service — templates live in src/templates/email/*.html
 */

import { getTransporter, isMailerConfigured } from '../config/mailer.js';
import logger from '../config/logger.js';
import { renderTemplate } from '../templates/templateEngine.js';

/** Shared date-format options used across several emails */
const DATE_FMT = {
  timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
};

class EmailService {
  // ─── helpers ───────────────────────────────────────────────────────

  /** Build the "from" address once */
  _from() {
    return process.env.EMAIL_FROM || process.env.GMAIL_EMAIL || 'noreply@urlshortener.io';
  }

  /** Truncate URL for display */
  _truncateUrl(url, maxLength) {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  }

  /** Human-readable time label from minutes */
  _humanTime(minutes) {
    if (minutes >= 1440) {
      const d = Math.round(minutes / 1440);
      return `${d} day${d === 1 ? '' : 's'}`;
    }
    if (minutes >= 60) {
      const h = Math.round(minutes / 60);
      return `${h} hour${h === 1 ? '' : 's'}`;
    }
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  // ─── notifications ────────────────────────────────────────────────

    /**
   * Send welcome email to new user
   * @param {object} user - User document
   * @returns {Promise<boolean>}
   */
  async sendWelcomeEmail(user) {
    if (!isMailerConfigured()) return false;
    const transporter = getTransporter();
    if (!transporter) return false;

    try {
      const appUrl = process.env.BASE_URL || 'http://localhost:3000';

      const htmlContent = renderTemplate('email', 'welcome', {
        userEmail: user.email,
        appUrl,
      });

      const info = await transporter.sendMail({
        from: this._from(),
        to: user.email,
        subject: 'Welcome to URL Shortener',
        html: htmlContent,
      });

      logger.info(`[EMAIL] Sent welcome email to ${user.email} (Message ID: ${info.messageId})`);
      return true;
    } catch (err) {
      logger.error(`[EMAIL] Failed to send welcome email:`, err.message);
      return false;
    }
  }

  /**
   * Send link expiry notification
   * @param {object} user - User document
   * @param {object} link - Link document
   * @returns {Promise<boolean>}
   */
  async sendLinkExpiryNotification(user, link) {
    if (!isMailerConfigured()) {
      logger.warn('[EMAIL] Mailer not configured, skipping notification');
      return false;
    }
    const transporter = getTransporter();
    if (!transporter) return false;

    try {
      const appUrl = process.env.BASE_URL || 'http://localhost:3000';
      const minutesUntilExpiry = Math.max(1, Math.round(
        (new Date(link.expiresAt) - Date.now()) / (1000 * 60)
      ));
      const timeLabel = this._humanTime(minutesUntilExpiry);
      const expiresFormatted = new Date(link.expiresAt).toLocaleString('en-GB', DATE_FMT);

      const htmlContent = renderTemplate('email', 'linkExpiry', {
        userEmail: user.email,
        timeLabel,
        linkCode: link.code,
        originalUrl: link.originalUrl,
        truncatedUrl: this._truncateUrl(link.originalUrl, 60),
        expiresFormatted,
        clicks: link.clicks,
        appUrl,
      });

      const info = await transporter.sendMail({
        from: this._from(),
        to: user.email,
        subject: `⏰ Your link "${link.code}" will expire in ${timeLabel}`,
        html: htmlContent,
        text: `Your shortened link "${link.code}" will expire in ${timeLabel}. Log in to your dashboard to regenerate it.`,
      });

      logger.info(`[EMAIL] Sent expiry notification to ${user.email} for link ${link.code} (Message ID: ${info.messageId})`);
      return true;
    } catch (err) {
      logger.error(`[EMAIL] Failed to send notification to ${user.email}:`, err.message);
      return false;
    }
  }

  /**
   * Send link creation confirmation email
   * @param {object} user - User document
   * @param {object} link - Link document
   * @returns {Promise<boolean>}
   */
  async sendLinkCreatedNotification(user, link) {
    if (!isMailerConfigured()) {
      logger.warn('[EMAIL] Mailer not configured, skipping creation notification');
      return false;
    }
    const transporter = getTransporter();
    if (!transporter) return false;

    try {
      const appUrl = process.env.APP_URL || process.env.BASE_URL || 'http://localhost:3000';
      const hasExpiry = link.expiresAt != null;
      const expiresFormatted = hasExpiry
        ? new Date(link.expiresAt).toLocaleString('en-GB', DATE_FMT)
        : null;

      const expiryLine = hasExpiry
        ? `<strong>Expires at:</strong> ${expiresFormatted} GMT+1`
        : `<strong>Expires:</strong> Never (permanent link)`;

      const expiryNote = hasExpiry
        ? '<p>You will receive reminder emails before and after this link expires.</p>'
        : '';

      const htmlContent = renderTemplate('email', 'linkCreated', {
        userEmail: user.email,
        linkCode: link.code,
        originalUrl: link.originalUrl,
        truncatedUrl: this._truncateUrl(link.originalUrl, 60),
        expiryLine,
        expiryNote,
        appUrl,
      });

      const subject = hasExpiry
        ? `\u2705 Link "${link.code}" created — expires ${expiresFormatted} GMT+1`
        : `\u2705 Link "${link.code}" created successfully`;

      const textBody = hasExpiry
        ? `Your shortened link "${link.code}" has been created. It expires at ${expiresFormatted} GMT+1.`
        : `Your shortened link "${link.code}" has been created. It does not expire.`;

      const info = await transporter.sendMail({
        from: this._from(),
        to: user.email,
        subject,
        html: htmlContent,
        text: textBody,
      });

      logger.info(`[EMAIL] Sent creation notification to ${user.email} for link ${link.code} (Message ID: ${info.messageId})`);
      return true;
    } catch (err) {
      logger.error(`[EMAIL] Failed to send creation notification to ${user.email}:`, err.message);
      return false;
    }
  }

  /**
   * Send link expired notification (sent 2 minutes after expiry)
   * @param {object} user - User document
   * @param {object} link - Link document
   * @returns {Promise<boolean>}
   */
  async sendLinkExpiredNotification(user, link) {
    if (!isMailerConfigured()) {
      logger.warn('[EMAIL] Mailer not configured, skipping expired notification');
      return false;
    }
    const transporter = getTransporter();
    if (!transporter) return false;

    try {
      const appUrl = process.env.APP_URL || process.env.BASE_URL || 'http://localhost:3000';
      const expiredFormatted = new Date(link.expiresAt).toLocaleString('en-GB', DATE_FMT);

      const htmlContent = renderTemplate('email', 'linkExpired', {
        userEmail: user.email,
        linkCode: link.code,
        originalUrl: link.originalUrl,
        truncatedUrl: this._truncateUrl(link.originalUrl, 60),
        expiredFormatted,
        clicks: link.clicks,
        appUrl,
      });

      const info = await transporter.sendMail({
        from: this._from(),
        to: user.email,
        subject: `\u274C Your link "${link.code}" has expired`,
        html: htmlContent,
        text: `Your shortened link "${link.code}" has expired as of ${expiredFormatted} GMT+1. Log in to your dashboard to recreate it.`,
      });

      logger.info(`[EMAIL] Sent expired notification to ${user.email} for link ${link.code} (Message ID: ${info.messageId})`);
      return true;
    } catch (err) {
      logger.error(`[EMAIL] Failed to send expired notification to ${user.email}:`, err.message);
      return false;
    }
  }
}

export default new EmailService();
