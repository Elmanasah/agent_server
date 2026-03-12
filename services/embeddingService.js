/**
 * services/embeddingService.js
 *
 * Calls Vertex AI text-embedding-004 to turn text into 768-dimensional vectors.
 * Uses the same google-auth-library + fetch pattern already in index.js —
 * no new packages.
 *
 * text-embedding-004 returns L2-normalized unit vectors, so dot-product == 
 * cosine similarity. We configure the Vector Search index to use
 * DOT_PRODUCT_DISTANCE accordingly (higher score = more similar).
 */

import { GoogleAuth } from 'google-auth-library';
import config         from '../config.js';

const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform',
});

const EMBEDDING_MODEL = 'text-embedding-004';
const DIMENSIONS      = 768;

/**
 * Embed one string or an array of strings.
 * Internally batches arrays in groups of 250 (API limit).
 *
 * @param {string | string[]} input
 * @returns {Promise<number[] | number[][]>}  single vector or array of vectors
 */
export async function embed(input) {
    const isBatch = Array.isArray(input);
    const texts   = isBatch ? input : [input];

    const client     = await auth.getClient();
    const { token }  = await client.getAccessToken();

    const url = `https://${config.location}-aiplatform.googleapis.com/v1`
              + `/projects/${config.projectId}/locations/${config.location}`
              + `/publishers/google/models/${EMBEDDING_MODEL}:predict`;

    // Process in batches of 250 (Vertex AI limit)
    const BATCH = 250;
    const allVectors = [];

    for (let i = 0; i < texts.length; i += BATCH) {
        const batch = texts.slice(i, i + BATCH);

        const res = await fetch(url, {
            method:  'POST',
            headers: {
                Authorization:  `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                instances: batch.map(content => ({ content, task_type: 'RETRIEVAL_DOCUMENT' })),
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(`[embedding] API error ${res.status}: ${err.error?.message ?? res.statusText}`);
        }

        const data = await res.json();
        for (const prediction of data.predictions) {
            allVectors.push(prediction.embeddings.values);
        }
    }

    return isBatch ? allVectors : allVectors[0];
}

/**
 * Embed a query (uses RETRIEVAL_QUERY task type for better accuracy).
 */
export async function embedQuery(text) {
    const client    = await auth.getClient();
    const { token } = await client.getAccessToken();

    const url = `https://${config.location}-aiplatform.googleapis.com/v1`
              + `/projects/${config.projectId}/locations/${config.location}`
              + `/publishers/google/models/${EMBEDDING_MODEL}:predict`;

    const res = await fetch(url, {
        method:  'POST',
        headers: {
            Authorization:  `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            instances: [{ content: text, task_type: 'RETRIEVAL_QUERY' }],
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`[embedding] Query embed error ${res.status}: ${err.error?.message ?? res.statusText}`);
    }

    const data = await res.json();
    return data.predictions[0].embeddings.values;
}

export { DIMENSIONS };
