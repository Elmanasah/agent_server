/**
 * services/vectorSearchService.js
 *
 * All Vertex AI Vector Search operations:
 *   upsertDatapoints   — write vectors into the index
 *   findNeighbors      — query top-K nearest vectors
 *   removeDatapoints   — delete vectors by ID
 *
 * ── Scale path ───────────────────────────────────────────────────────────────
 * Every vector carries:
 *   restricts: [{ namespace: "userId", allowList: [userId] }]
 *
 * Right now userId = "default" for the single-user setup.
 * When you add auth, just pass the real UID — the index, endpoint, and
 * every function signature below stays exactly the same.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { GoogleAuth } from 'google-auth-library';
import config         from '../config.js';

const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform',
});

// Vertex AI management API base URL
const MGMT = (path) =>
    `https://${config.location}-aiplatform.googleapis.com/v1`
  + `/projects/${config.projectId}/locations/${config.location}${path}`;

async function getToken() {
    const client    = await auth.getClient();
    const { token } = await client.getAccessToken();
    return token;
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

/**
 * Write an array of vectors into the streaming-update index.
 *
 * @param {string} userId                    - "default" now; real UID later
 * @param {{ id: string, vector: number[], docId: string }[]} datapoints
 */
export async function upsertDatapoints(userId, datapoints) {
    const token = await getToken();

    const body = {
        datapoints: datapoints.map(dp => ({
            datapointId:   dp.id,
            featureVector: dp.vector,
            restricts: [
                // This is the namespace that isolates data per user.
                // Single user: allowList is always ["default"].
                // Multi-user: allowList is ["alice"], ["bob"], etc.
                { namespace: 'userId', allowList: [userId] },
            ],
        })),
    };

    const res = await fetch(
        MGMT(`/indexes/${config.vectorSearchIndexId}:upsertDatapoints`),
        {
            method:  'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        }
    );

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`[vectorSearch] upsert failed ${res.status}: ${err.error?.message ?? res.statusText}`);
    }

    return res.json(); // Returns {} on success
}

// ─── Query ────────────────────────────────────────────────────────────────────

/**
 * Find the topK most similar vectors for a given query vector,
 * scoped strictly to the given userId namespace.
 *
 * @param {string}   userId        - namespace to scope the search
 * @param {number[]} queryVector   - 768-dim embedding of the user's message
 * @param {number}   topK
 * @returns {Promise<{ datapointId: string, distance: number }[]>}
 */
export async function findNeighbors(userId, queryVector, topK = 5) {
    const token = await getToken();

    const body = {
        deployedIndexId: config.vectorSearchDeployedIndexId,
        queries: [{
            datapoint: {
                datapointId:   'query',
                featureVector: queryVector,
                restricts: [
                    // Only return vectors that have this userId in their allowList.
                    // A user can never see another user's chunks — the index enforces this.
                    { namespace: 'userId', allowList: [userId] },
                ],
            },
            neighborCount:             topK,
            approximateNeighborCount:  topK * 3, // over-fetch before re-ranking
        }],
    };

    // findNeighbors must hit the public endpoint domain, NOT the management API.
    // The management API returns 501 for query operations on public endpoints.
    const queryBase = `https://${config.vectorSearchPublicEndpointDomain}/v1`
                    + `/projects/${config.projectId}/locations/${config.location}`;
    const res = await fetch(
        `${queryBase}/indexEndpoints/${config.vectorSearchEndpointId}:findNeighbors`,
        {
            method:  'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        }
    );

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`[vectorSearch] findNeighbors failed ${res.status}: ${err.error?.message ?? res.statusText}`);
    }

    const data = await res.json();
    const neighbors = data.nearestNeighbors?.[0]?.neighbors ?? [];

    // DOT_PRODUCT_DISTANCE: higher score = more similar.
    // Filter out weak matches (< 0.6 = less than 60% similar).
    return neighbors
        .filter(n => n.distance >= 0.6)
        .map(n => ({
            datapointId: n.datapoint.datapointId,
            distance:    n.distance,
        }));
}

// ─── Remove ───────────────────────────────────────────────────────────────────

/**
 * Delete vectors from the index by their datapoint IDs.
 *
 * @param {string[]} datapointIds
 */
export async function removeDatapoints(datapointIds) {
    if (!datapointIds.length) return;

    const token = await getToken();

    const res = await fetch(
        MGMT(`/indexes/${config.vectorSearchIndexId}:removeDatapoints`),
        {
            method:  'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify({ datapointIds }),
        }
    );

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`[vectorSearch] removeDatapoints failed ${res.status}: ${err.error?.message ?? res.statusText}`);
    }
}
