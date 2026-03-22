/**
 * src/services/chunkStorage.service.js
 *
 * GCS source of truth for RAG chunk text and document metadata.
 *
 * Bucket layout:
 *   gs://{GCS_BUCKET_NAME}/
 *     chunks/{userId}/{chunkId}.json    ← { text, fileName, docId }
 *     documents/{userId}/{docId}.json  ← { docId, fileName, mimeType, chunkIds[], uploadedAt }
 *
 * NOTE: Document metadata is also stored in CockroachDB (Document model).
 * GCS is kept for chunk text (too large for DB rows).
 */

import { Storage } from '@google-cloud/storage';
import config from '../../config/index.js';

const storage = new Storage({ projectId: config.projectId });
const bucket = () => storage.bucket(config.gcsBucketName);

// ── Chunk text ─────────────────────────────────────────────────────────────────

export async function saveChunk(userId, chunkId, data) {
    const file = bucket().file(`chunks/${userId}/${chunkId}.json`);
    await file.save(JSON.stringify(data), { contentType: 'application/json', resumable: false });
}

export async function getChunk(userId, chunkId) {
    try {
        const [contents] = await bucket().file(`chunks/${userId}/${chunkId}.json`).download();
        return JSON.parse(contents.toString('utf8'));
    } catch (err) {
        if (err.code === 404) return null;
        throw err;
    }
}

export async function getChunks(userId, chunkIds) {
    const results = await Promise.all(
        chunkIds.map(async (chunkId) => {
            const data = await getChunk(userId, chunkId);
            return data ? { ...data, chunkId } : null;
        })
    );
    return results.filter(Boolean);
}

export async function deleteChunks(userId, chunkIds) {
    await Promise.all(
        chunkIds.map(chunkId =>
            bucket().file(`chunks/${userId}/${chunkId}.json`).delete({ ignoreNotFound: true })
        )
    );
}

// ── Document metadata ──────────────────────────────────────────────────────────

export async function saveDocumentMeta(userId, meta) {
    const file = bucket().file(`documents/${userId}/${meta.docId}.json`);
    const record = { ...meta, uploadedAt: new Date().toISOString() };
    await file.save(JSON.stringify(record), { contentType: 'application/json', resumable: false });
}

export async function getDocumentMeta(userId, docId) {
    try {
        const [contents] = await bucket().file(`documents/${userId}/${docId}.json`).download();
        return JSON.parse(contents.toString('utf8'));
    } catch (err) {
        if (err.code === 404) return null;
        throw err;
    }
}

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

export async function deleteDocumentMeta(userId, docId) {
    await bucket()
        .file(`documents/${userId}/${docId}.json`)
        .delete({ ignoreNotFound: true });
}
