/**
 * src/modules/documents/documents.routes.js
 */

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import * as documentsController from './documents.controller.js';

const router = Router();

const ingestSchema = z.object({
    fileName: z.string().min(1),
    mimeType: z.string().min(1),
    data: z.string().min(1), // base64
});

router.post('/ingest', validate(ingestSchema), documentsController.ingest);
router.get('/', documentsController.list);
router.delete('/:docId', documentsController.remove);

export default router;
