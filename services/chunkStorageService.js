/**
 * services/chunkStorageService.js
 *
 * Cloud Storage is the source of truth for:
 *   - Chunk text   →  chunks/{userId}/{chunkId}.json
 *   - Doc metadata →  documents/{userId}/{docId}.json
 *
 * When Vector Search returns matching datapointIds, we fetch the
 * corresponding chunk JSON from GCS to get the actual text.
 *
 * Bucket layout:
 *   gs://{GCS_BUCKET_NAME}/
 *     chunks/
 *       {userId}/
 *         {docId}_chunk_0.json    ← { text, fileName, docId }
 *         {docId}_chunk_1.json
 *     documents/
 *       {userId}/
 *         {docId}.json            ← { docId, fileName, mimeType, chunkIds[], uploadedAt }
 *
 * ── Scale path ───────────────────────────────────────────────────────────────
 * The path prefix is always /{userId}/. Single user uses "default".
 * Multi-user just passes the real UID — bucket layout is identical.
 * GCS IAM can further lock down per-user access if needed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Storage } from '@google-cloud/storage';
import config      from '../config.js';

const storage = new Storage({ projectId: config.projectId });
const bucket  = () => storage.bucket(config.gcsBucketName);

// ─── Chunk text ───────────────────────────────────────────────────────────────

/**
 * Persist a chunk's text to GCS.
 *
 * @param {string} userId
 * @param {string} chunkId   - same ID used as datapointId in Vector Search
 * @param {{ text: string, fileName: string, docId: string }} data
 */
export async function saveChunk(userId, chunkId, data) {
    const file    = bucket().file(`chunks/${userId}/${chunkId}.json`);
    const content = JSON.stringify(data);
    await file.save(content, { contentType: 'application/json', resumable: false });
}

/**
 * Retrieve chunk text from GCS by its ID.
 * Returns null if the chunk doesn't exist (graceful degradation).
 *
 * @param {string} userId
 * @param {string} chunkId
 * @returns {Promise<{ text: string, fileName: string, docId: string } | null>}
 */
export async function getChunk(userId, chunkId) {
    try {
        const file = bucket().file(`chunks/${userId}/${chunkId}.json`);
        const [contents] = await file.download();
        return JSON.parse(contents.toString('utf8'));
    } catch (err) {
        if (err.code === 404) return null;
        throw err;
    }
}

/**
 * Fetch multiple chunks in parallel.
 * Missing chunks are silently skipped.
 *
 * @param {string}   userId
 * @param {string[]} chunkIds
 * @returns {Promise<{ text: string, fileName: string, docId: string, chunkId: string }[]>}
 */
export async function getChunks(userId, chunkIds) {
    const results = await Promise.all(
        chunkIds.map(async (chunkId) => {
            const data = await getChunk(userId, chunkId);
            return data ? { ...data, chunkId } : null;
        })
    );
    return results.filter(Boolean);
}

/**
 * Delete all chunks for a given document.
 *
 * @param {string} userId
 * @param {string[]} chunkIds  - from the document metadata record
 */
export async function deleteChunks(userId, chunkIds) {
    await Promise.all(
        chunkIds.map(chunkId =>
            bucket().file(`chunks/${userId}/${chunkId}.json`).delete({ ignoreNotFound: true })
        )
    );
}

// ─── Document metadata ────────────────────────────────────────────────────────

/**
 * Save document metadata (written after successful ingestion).
 *
 * @param {string} userId
 * @param {{ docId: string, fileName: string, mimeType: string, chunkIds: string[] }} meta
 */
export async function saveDocumentMeta(userId, meta) {
    const file    = bucket().file(`documents/${userId}/${meta.docId}.json`);
    const record  = { ...meta, uploadedAt: new Date().toISOString() };
    await file.save(JSON.stringify(record), { contentType: 'application/json', resumable: false });
}

/**
 * Retrieve metadata for a single document.
 *
 * @param {string} userId
 * @param {string} docId
 * @returns {Promise<object | null>}
 */
export async function getDocumentMeta(userId, docId) {
    try {
        const file = bucket().file(`documents/${userId}/${docId}.json`);
        const [contents] = await file.download();
        return JSON.parse(contents.toString('utf8'));
    } catch (err) {
        if (err.code === 404) return null;
        throw err;
    }
}

/**
 * List all documents for a user by listing the documents/{userId}/ GCS prefix.
 *
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export async function listDocuments(userId) {
    const [files] = await bucket().getFiles({ prefix: `documents/${userId}/` });

    const metas = await Promise.all(
        files.map(async (file) => {
            try {
                const [contents] = await file.download();
                return JSON.parse(contents.toString('utf8'));
            } catch {
                return null;
            }
        })
    );

    return metas.filter(Boolean);
}

/**
 * Delete the document metadata file.
 *
 * @param {string} userId
 * @param {string} docId
 */
export async function deleteDocumentMeta(userId, docId) {
    await bucket()
        .file(`documents/${userId}/${docId}.json`)
        .delete({ ignoreNotFound: true });
}
