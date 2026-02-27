/**
 * src/routes/api.js
 * All /api/* routes.
 */

import { Router } from 'express';
import ctrl from '../controllers/linkController.js';
import { validateShorten } from '../validators/linkValidator.js';

const router = Router();

// Health
router.get('/health', ctrl.health);

// Links
router.post('/links',                  validateShorten, ctrl.shorten);
router.get('/links',                                    ctrl.list);
router.get('/links/:code/analytics',                    ctrl.analytics);
router.delete('/links/:code',                           ctrl.remove);

// API info
router.get('/', (_req, res) => {
  res.json({
    name:    'URL Shortener API',
    version: '1.0.0',
    endpoints: {
      'POST   /api/links':                    'Shorten a URL',
      'GET    /api/links':                    'List all links (paginated)',
      'GET    /api/links/:code/analytics':    'Click analytics for a link',
      'DELETE /api/links/:code':              'Delete a link',
      'GET    /api/health':                   'Health check',
      'GET    /:code':                        'Redirect to original URL',
    },
    body: {
      'POST /api/links': {
        originalUrl: 'string (required)',
        customCode:  'string (optional, 2–30 chars)',
        expiresAt:   'ISO datetime (optional)',
      },
    },
  });
});

export default router;