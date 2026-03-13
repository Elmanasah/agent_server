/**
 * src/modules/sessions/sessions.routes.js
 */

import { Router } from 'express';
import * as sessionsController from './sessions.controller.js';

const router = Router();

router.get('/sessions', sessionsController.list);
router.get('/sessions/:id', sessionsController.get);
router.delete('/sessions/:id', sessionsController.remove);

export default router;
