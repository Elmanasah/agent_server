/**
 * src/modules/sessions/sessions.routes.js
 */

import { Router } from 'express';
import * as sessionsController from './sessions.controller.js';

const router = Router();

router.get('/', sessionsController.list);
router.get('/:id', sessionsController.get);
router.delete('/:id', sessionsController.remove);

export default router;
