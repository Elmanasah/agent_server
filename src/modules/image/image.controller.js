/**
 * src/modules/image/image.controller.js
 */

import { generateImage } from '../image/image.service.js';

/**
 * POST /generate-image
 */
export async function generate(req, res, next) {
    const { prompt } = req.body;
    try {
        const result = await generateImage(prompt);
        res.json(result);
    } catch (err) {
        next(err);
    }
}
