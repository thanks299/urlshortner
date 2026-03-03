/**
 * src/services/emailService.js
 * Email sending service
 */

import { getTransporter, isMailerConfigured } from '../config/mailer.js';
import logger from '../config/logger.js';

class EmailService {
  /**
   * Send link expiry notification
   * @param {object} user - User document
   * @param {object} link - Link document
   * @returns {Promise<boolean>} - Success status
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
      
      let timeLabel;
      if (minutesUntilExpiry >= 60) {
        const hours = Math.round(minutesUntilExpiry / 60);
        const hourPlural = hours === 1 ? '' : 's';
        timeLabel = `${hours} hour${hourPlural}`;
      } else {
        const minutePlural = minutesUntilExpiry === 1 ? '' : 's';
        timeLabel = `${minutesUntilExpiry} minute${minutePlural}`;
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; }
              .content { margin: 20px 0; }
              .link-info { background: #f5f5f5; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0; border-radius: 4px; }
              .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
              .footer { color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>⏰ Your Link Will Expire Soon</h1>
              </div>

              <div class="content">
                <p>Hi ${user.email},</p>

                <p>One of your shortened links will expire in <strong>${timeLabel}</strong>. After expiration, the link will no longer redirect to the original URL.</p>

                <div class="link-info">
                  <strong>Short Code:</strong> ${link.code}<br>
                  <strong>Original URL:</strong> <a href="${link.originalUrl}">${this._truncateUrl(link.originalUrl, 60)}</a><br>
                  <strong>Expires at:</strong> ${new Date(link.expiresAt).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} GMT+1<br>
                  <strong>Clicks:</strong> ${link.clicks}
                </div>

                <p>If you'd like to keep this link active, you can:</p>
                <ul>
                  <li><strong>Regenerate:</strong> Log in and shorten the URL again with a new expiry date</li>
                  <li><strong>Extend:</strong> Create a permanent version without an expiry date</li>
                </ul>

                <a href="${appUrl}/app" class="button">Go to Dashboard</a>

                <div class="footer">
                  <p>This is an automated notification from URL Shortener. Please don't reply to this email.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.GMAIL_EMAIL || 'noreply@urlshortener.io',
        to: user.email,
        subject: `⏰ Your link "${link.code}" will expire in ${timeLabel}`,
        html: htmlContent,
        text: `Your shortened link "${link.code}" will expire in ${timeLabel}. Log in to your dashboard to regenerate it.`,
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info(`[EMAIL] Sent expiry notification to ${user.email} for link ${link.code} (Message ID: ${info.messageId})`);
      return true;
    } catch (err) {
      logger.error(`[EMAIL] Failed to send notification to ${user.email}:`, err.message);
      return false;
    }
  }

  /**
   * Truncate URL for display
   */
  _truncateUrl(url, maxLength) {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  }

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

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
              .content { margin: 20px 0; }
              .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
              .footer { color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to URL Shortener 🔗</h1>
              </div>

              <div class="content">
                <p>Hi ${user.email},</p>
                <p>Welcome! Your account has been created successfully.</p>
                <p>You can now start shortening URLs and tracking their performance.</p>
                
                <a href="${appUrl}/app" class="button">Go to Dashboard</a>

                <div class="footer">
                  <p>If you have any questions, feel free to reach out.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.GMAIL_EMAIL || 'noreply@urlshortener.io',
        to: user.email,
        subject: 'Welcome to URL Shortener',
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info(`[EMAIL] Sent welcome email to ${user.email}`);
      return true;
    } catch (err) {
      logger.error(`[EMAIL] Failed to send welcome email:`, err.message);
      return false;
    }
  }
}

export default new EmailService();
