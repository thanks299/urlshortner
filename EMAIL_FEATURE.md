# Email Notification Feature - Implementation Summary

## Overview
Email notifications have been integrated to notify authorized users when their shortened links are about to expire. Only the user who created a link will receive expiry notifications for that specific link.

## Files Created

### 1. `src/config/mailer.js`
- Initializes Nodemailer transporter
- Supports multiple email providers: Gmail, Outlook, SendGrid, or custom SMTP
- Handles connection verification on startup
- Provides transporter getter and configuration status check

**Key Functions:**
- `initMailer()` - Initialize email service on app startup
- `getTransporter()` - Get configured transporter instance
- `isMailerConfigured()` - Check if email is available

### 2. `src/services/emailService.js`
- Handles email composition and sending
- Two main methods:
  - `sendLinkExpiryNotification(user, link)` - Sends expiry warning (24 hours before)
  - `sendWelcomeEmail(user)` - Welcome email for new registrations

**Email Details:**
- Professional HTML templates
- Shows link details: code, original URL, creation date, click count
- Includes countdown (hours until expiry)
- Direct dashboard link to generate new links
- User-specific notifications (authenticated users only)

### 3. `src/services/linkExpiryService.js`
- Checks for links expiring within a notification window
- Two main methods:
  - `checkAndNotifyExpiringLinks(hoursBeforeExpiry)` - Find expiring links and send emails
  - `cleanupExpiredLinks()` - Deactivate links that have already expired

**Key Features:**
- Only notifies each user once per link
- Scoped to authorized users (createdBy field)
- Atomic operations with proper error handling
- Prevents duplicate notifications

### 4. `src/controllers/adminController.js`
- Manages admin/maintenance operations
- Three endpoints:
  - `POST /api/admin/check-expiring-links` - Manually trigger expiry check
  - `POST /api/admin/cleanup-expired-links` - Clean up expired links
  - `GET /api/admin/stats` - System statistics

### 5. `src/routes/admin.js`
- Routes for admin operations
- All routes protected by authentication middleware
- Input validation and error handling

## Database Model Changes

Updated `src/models/Link.js` with new fields:
```javascript
notificationSent: Boolean      // Track if notification was sent
notificationSentAt: Date       // When notification was sent
expiredAt: Date               // When link was deactivated
```

## Application Integration

### In `src/app.js`:
1. Import mailer and link expiry service
2. Initialize mailer on app startup
3. Register admin routes at `/api/admin`
4. Set up periodic background task (every 6 hours by default)

### Periodic Task:
```javascript
// Runs automatically every 6 hours (configurable)
setInterval(async () => {
  await linkExpiryService.checkAndNotifyExpiringLinks(24);
}, checkIntervalHours * 60 * 60 * 1000);
```

## Environment Configuration

Add to `.env`:
```env
# Email Provider (gmail, outlook, sendgrid, or smtp)
EMAIL_PROVIDER=gmail

# For Gmail
GMAIL_EMAIL=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Or for other providers (see .env.email.example for details)

# Settings
EXPIRY_CHECK_INTERVAL_HOURS=6
APP_URL=http://localhost:3000
EMAIL_FROM=noreply@yourdomain.com
```

## Security & Access Control

- **User Scoping:** Links filter by `createdBy: userId` in all queries
- **Authentication Required:** Admin endpoints require valid JWT token
- **One-Time Notifications:** Each link generates only one expiry notification
- **Graceful Degradation:** If email is not configured, feature is disabled but doesn't break app

## API Reference

### Trigger Expiry Check Manually
```bash
POST /api/admin/check-expiring-links
Authorization: Bearer <token>
Content-Type: application/json

{
  "hoursBeforeExpiry": 24
}

# Response
{
  "success": true,
  "data": {
    "checkedAt": "2026-03-01T12:00:00Z",
    "linksFound": 5,
    "notificationsSent": 4,
    "notificationsFailed": 1
  }
}
```

### Cleanup Expired Links
```bash
POST /api/admin/cleanup-expired-links
Authorization: Bearer <token>

# Response
{
  "success": true,
  "data": {
    "cleanedAt": "2026-03-01T12:00:00Z",
    "linksDeactivated": 12
  }
}
```

### Get System Statistics
```bash
GET /api/admin/stats
Authorization: Bearer <token>

# Response
{
  "success": true,
  "data": {
    "timestamp": "2026-03-01T12:00:00Z",
    "links": {
      "total": 150,
      "active": 120,
      "expired": 30
    },
    "users": 25
  }
}
```

## Email Templates

### Link Expiry Notification
- **Subject:** `⏰ Your link "{code}" will expire in {hours} hours`
- **Content:**
  - Professional header
  - Personalized greeting
  - Link details (code, URL, creation date, clicks)
  - Countdown to expiry
  - Action buttons (Dashboard link)
  - Clear call-to-action instructions

### Welcome Email
- **Subject:** `Welcome to URL Shortener`
- **Content:**
  - Greeting and confirmation
  - Next steps
  - Dashboard link
  - Support information

## Testing

### Manual Test
```bash
# 1. Create a shortened link with expiry 25 hours from now
# 2. Wait for periodic check or trigger manually
curl -X POST http://localhost:3000/api/admin/check-expiring-links \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"hoursBeforeExpiry": 24}'

# 3. Check your email inbox for the notification
```

### Logs
The system logs all email operations:
```
[EMAIL] Sent expiry notification to user@example.com for link abc123
[EXPIRY] Found 5 links expiring within 24 hours
[EXPIRY] Notification run complete: {...}
```

## Performance Considerations

- **Indexed Queries:** `expiresAt`, `notificationSent`, `createdBy` are indexed
- **Batch Processing:** Checks all expiring links in a single query
- **Non-Blocking:** Periodic checks run asynchronously
- **Error Resilience:** Failed emails don't crash the app

## Future Enhancements

1. **Email History:** Track all sent emails in a separate collection
2. **Custom Templates:** Allow users to customize email content
3. **Resend Option:** Let users request resend of expiry notification
4. **Multiple Notifications:** Send reminders at different intervals (48h, 24h, 12h)
5. **Webhook Integration:** Send webhooks instead of/alongside emails
6. **Batch Email API:** Use AWS SES or similar for high volume

## Dependencies Added

- `nodemailer: ^6.9.7` - Email sending library

## Backward Compatibility

✅ Fully backward compatible
- If `EMAIL_PROVIDER` is not set, email features are disabled gracefully
- No breaking changes to existing APIs
- New fields in Link model default to `null`/`false`
