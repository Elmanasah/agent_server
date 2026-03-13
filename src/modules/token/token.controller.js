/**
 * src/modules/token/token.controller.js
 */

import { getAccessToken, getGcpConfig } from '../../services/auth.service.js';

/**
 * GET /token
 * Returns a short-lived Google Cloud access token for the frontend.
 */
export async function getToken(req, res, next) {
    try {
        const token = await getAccessToken();
        res.json({ token });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /config
 * Returns non-sensitive GCP config needed by the frontend.
 */
export function getConfig(req, res) {
    res.json(getGcpConfig());
}
