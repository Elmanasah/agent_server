/**
 * src/modules/token/token.routes.js
 */

import { Router } from 'express';
import * as tokenController from './token.controller.js';

const router = Router();

router.get('/token', tokenController.getToken);
router.get('/config', tokenController.getConfig);

export default router;
