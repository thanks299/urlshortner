/**
 * src/routes/redirect.js
 * Handles short code redirects and serves the frontend.
 */

import { Router } from 'express';
import redirectCtrl from '../controllers/redirectControllers.js';

const router = Router();

router.get('/',     redirectCtrl.home);
router.get('/:code', redirectCtrl.redirect);

export default router;