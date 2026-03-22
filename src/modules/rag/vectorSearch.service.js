/**
 * src/services/vectorSearch.service.js
 *
 * Vertex AI Vector Search operations:
 *   upsertDatapoints — write vectors into the streaming-update index
 *   findNeighbors    — query top-K nearest vectors (userId-scoped)
 *   removeDatapoints — delete vectors by ID
 */

import { GoogleAuth } from 'google-auth-library';
import config from '../../config/index.js';

const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform',
});

async function getToken() {
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    return token;
}

const MGMT = (path) =>
    `https://${config.location}-aiplatform.googleapis.com/v1`
    + `/projects/${config.projectId}/locations/${config.location}${path}`;

/**
 * Write vectors into the streaming-update index.
 * @param {string} userId
 * @param {{ id: string, vector: number[], docId: string }[]} datapoints
 */
export async function upsertDatapoints(userId, datapoints) {
    const token = await getToken();

    const body = {
        datapoints: datapoints.map(dp => ({
            datapointId: dp.id,
            featureVector: dp.vector,
            restricts: [
                { namespace: 'userId', allowList: [userId] },
            ],
        })),
    };

    const res = await fetch(
        MGMT(`/indexes/${config.vectorSearchIndexId}:upsertDatapoints`),
        {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }
    );

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`[vectorSearch] upsert failed ${res.status}: ${err.error?.message ?? res.statusText}`);
    }

    return res.json();
}

/**
 * Find topK nearest vectors, scoped to userId namespace.
 * @param {string}   userId
 * @param {number[]} queryVector
 * @param {number}   topK
 * @returns {Promise<{ datapointId: string, distance: number }[]>}
 */
export async function findNeighbors(userId, queryVector, topK = 5) {
    const token = await getToken();

    const body = {
        deployedIndexId: config.vectorSearchDeployedIndexId,
        queries: [{
            datapoint: {
                datapointId: 'query',
                featureVector: queryVector,
                restricts: [
                    { namespace: 'userId', allowList: [userId] },
                ],
            },
            neighborCount: topK,
            approximateNeighborCount: topK * 3,
        }],
    };

    const queryBase = `https://${config.vectorSearchPublicEndpointDomain}/v1`
        + `/projects/${config.projectId}/locations/${config.location}`;

    const res = await fetch(
        `${queryBase}/indexEndpoints/${config.vectorSearchEndpointId}:findNeighbors`,
        {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }
    );

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`[vectorSearch] findNeighbors failed ${res.status}: ${err.error?.message ?? res.statusText}`);
    }

    const data = await res.json();
    const neighbors = data.nearestNeighbors?.[0]?.neighbors ?? [];

    return neighbors
        .filter(n => n.distance >= 0.6)
        .map(n => ({
            datapointId: n.datapoint.datapointId,
            distance: n.distance,
        }));
}

/**
 * Delete vectors from the index by datapoint IDs.
 * @param {string[]} datapointIds
 */
export async function removeDatapoints(datapointIds) {
    if (!datapointIds.length) return;

    const token = await getToken();

    const res = await fetch(
        MGMT(`/indexes/${config.vectorSearchIndexId}:removeDatapoints`),
        {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ datapointIds }),
        }
    );

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`[vectorSearch] removeDatapoints failed ${res.status}: ${err.error?.message ?? res.statusText}`);
    }
}
