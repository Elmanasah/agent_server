// src/modules/logs/log.routes.js

import { Router } from 'express';
import { allowTo } from '../../middleware/allowTo.js';
import { getMyLogs, getAllLogs } from './log.controller.js';

const router = Router();

// Any authenticated user can read their own logs
router.get('/me', getMyLogs);

// Admin only — all logs, filterable by userId and category
router.get('/', allowTo('admin'), getAllLogs);

export default router;
