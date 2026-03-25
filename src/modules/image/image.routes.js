/**
 * src/modules/image/image.routes.js
 */

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import * as imageController from './image.controller.js';
import { usageGuard } from '../../middleware/usageGuard.middleware.js';
import { RESOURCE_TYPES } from '../usage/usage.service.js';
const router = Router();

const imageSchema = z.object({
    prompt: z.string().min(1, 'Prompt is required'),
});

router.post('/generate', usageGuard(RESOURCE_TYPES.IMAGE), validate(imageSchema), imageController.generate);
export default router;
