/**
 * src/services/image.service.js
 *
 * Imagen 3 image generation via Vertex AI REST API.
 */

import { GoogleAuth } from 'google-auth-library';
import config from '../config/index.js';

const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform',
});

/**
 * Generate an image from a text prompt using Imagen 3.
 * @param {string} prompt
 * @returns {Promise<{ imageUrl: string, prompt: string }>}
 */
export async function generateImage(prompt) {
    const client = await auth.getClient();
    const project = await auth.getProjectId();
    const { token } = await client.getAccessToken();
    const location = config.location;

    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/imagen-3.0-generate-001:predict`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            instances: [{ prompt }],
            parameters: { sampleCount: 1 },
        }),
    });

    if (!response.ok) {
        const e = await response.json().catch(() => ({}));
        throw new Error(e.error?.message || 'Image generation failed');
    }

    const data = await response.json();
    return {
        imageUrl: `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`,
        prompt,
    };
}
