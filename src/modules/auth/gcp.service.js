/**
 * src/services/auth.service.js
 *
 * Google Cloud OAuth2 access token helper.
 * Used by the /token endpoint so the frontend can authenticate
 * against Vertex AI APIs directly (e.g. Gemini Live).
 */

import { GoogleAuth } from 'google-auth-library';
import config from '../../config/index.js';

const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform',
});

/**
 * Get a short-lived Google Cloud access token.
 * @returns {Promise<string>} Bearer token
 */
export async function getAccessToken() {
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    return token;
}

/**
 * Get GCP project config for the client.
 * @returns {{ projectId: string, location: string }}
 */
export function getGcpConfig() {
    return {
        projectId: config.projectId,
        location: config.location,
    };
}
