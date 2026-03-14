/**
 * src/modules/chat/chat.routes.js
 *
 * The /chat POST endpoint streams SSE. The validate middleware runs before
 * the controller so it can still reject bad input early (before SSE headers).
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

// SSE streaming chat — POST (fetch with ReadableStream on client side)
router.post('/', validate(chatSchema), chatController.chat);

// Reset session agent cache
router.post('/reset', chatController.reset);

export default router;
