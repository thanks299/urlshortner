/**
 * src/controllers/redirectController.js
 * Handles /:code GET requests — resolves and redirects.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import linkService from '../services/linkService.js';
import catchAsync from '../utils/catchAsync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class RedirectController {

  /**
   * GET /:code
   * Resolve short code → 302 redirect or styled error page.
   */
  redirect = catchAsync(async (req, res, next) => {
    const { code } = req.params;

    if (!/^[a-zA-Z0-9_-]{2,30}$/.test(code)) return next();

    const clickMeta = {
      ip:        req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip,
      userAgent: req.headers['user-agent'] || 'unknown',
      referer:   req.headers['referer'] || null,
    };

    try {
      const originalUrl = await linkService.resolveCode(code, clickMeta);
      return res.redirect(302, originalUrl);
    } catch (err) {
      const status  = err.statusCode || 500;
      const title   = status === 404 ? 'Link Not Found'
                    : status === 410 ? 'Link Expired'
                    : 'Something Went Wrong';
      const message = err.message || 'An unexpected error occurred.';
      return res.status(status).send(errorHtml(title, message, status, code));
    }
  });

  home = (_req, res) => {
    res.sendFile(path.resolve(process.cwd(), 'src', 'public', 'index.html'));
  };
}

function esc(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function errorHtml(title, message, code) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)} — SNIP</title>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0a0a0a;color:#f0f0f0;font-family:'DM Mono',monospace;
         display:flex;align-items:center;justify-content:center;min-height:100vh}
    .box{text-align:center;padding:60px 40px}
    .num{font-family:'Bebas Neue',sans-serif;font-size:140px;line-height:1;
         color:#e8ff47;opacity:.12;user-select:none}
    h1{font-family:'Bebas Neue',sans-serif;font-size:38px;letter-spacing:3px;margin:12px 0 10px}
    p{color:#666;font-size:14px;max-width:380px;margin:0 auto 28px;line-height:1.7}
    a{display:inline-block;background:#e8ff47;color:#0a0a0a;
      font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;
      padding:12px 30px;text-decoration:none;border-radius:2px}
  </style></head>
  <body><div class="box">
    <div class="num">${code}</div>
    <h1>${esc(title)}</h1>
    <p>${esc(message)}</p>
    <a href="/">← Back to SNIP</a>
  </div></body></html>`;
}

export default new RedirectController();
