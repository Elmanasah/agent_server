/**
 * src/services/embedding.service.js
 *
 * Wraps the Vertex AI text-embedding-004 model.
 * Two task types:
 *   embed()      — RETRIEVAL_DOCUMENT (for indexing chunks)
 *   embedQuery() — RETRIEVAL_QUERY    (for querying)
 */

import { VertexAI } from '@google-cloud/vertexai';
import config from '../config/index.js';

const vertexAI = new VertexAI({ project: config.projectId, location: config.location });

const embeddingModel = vertexAI.getGenerativeModel({ model: 'text-embedding-004' });

const BATCH_SIZE = 250; // Vertex AI limit

async function batchEmbed(texts, taskType) {
    const vectors = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);

        const instances = batch.map(t => ({
            task_type: taskType,
            content: t,
        }));

        const response = await embeddingModel.embedContent({ instances });
        if (!response?.predictions) throw new Error('No embedding predictions returned');

        for (const pred of response.predictions) {
            vectors.push(pred.embeddings.values);
        }
    }

    return vectors;
}

/**
 * Embed an array of document chunks.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embed(texts) {
    return batchEmbed(texts, 'RETRIEVAL_DOCUMENT');
}

/**
 * Embed a single query string.
 * @param {string} queryText
 * @returns {Promise<number[]>}
 */
export async function embedQuery(queryText) {
    const [vector] = await batchEmbed([queryText], 'RETRIEVAL_QUERY');
    return vector;
}
