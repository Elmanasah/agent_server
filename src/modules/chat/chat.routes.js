/**
 * src/modules/chat/chat.routes.js
 */

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import * as chatController from './chat.controller.js';

const router = Router();

const chatSchema = z.object({
    message: z.string().optional(),
    attachments: z.array(z.object({
        data: z.string(),
        mimeType: z.string(),
    })).optional().default([]),
    sessionId: z.string().uuid().optional().nullable().default(null),
});

router.post('/', validate(chatSchema), chatController.chat);
router.post('/reset', chatController.reset);

export default router;
