/**
 * src/services/rag.service.js
 *
 * RAG orchestration:
 *   ingestDocument()  — file → text → chunks → embeddings → GCS + Vector Search + DB
 *   retrieveContext() — query → embed → findNeighbors → GCS chunk text → prompt
 *   deleteDocument()  — remove vectors, GCS chunks, DB record
 *   listDocuments()   — list from GCS metadata
 */

import { randomUUID } from 'crypto';
import { embed, embedQuery } from './embedding.service.js';
import { upsertDatapoints, findNeighbors, removeDatapoints } from './vectorSearch.service.js';
import {
    saveChunk, getChunks, deleteChunks,
    saveDocumentMeta, getDocumentMeta, listDocuments as listDocumentsGCS, deleteDocumentMeta,
} from './chunkStorage.service.js';
import { Document } from '../models/index.js';

// ── Text chunking ─────────────────────────────────────────────────────────────

const CHUNK_WORDS = 400;
const OVERLAP_WORDS = 60;

function chunkText(text) {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks = [];
    let i = 0;

    while (i < words.length) {
        const end = Math.min(i + CHUNK_WORDS, words.length);
        const chunk = words.slice(i, end).join(' ');
        if (chunk.trim().length > 30) chunks.push(chunk);
        if (end >= words.length) break;
        i += CHUNK_WORDS - OVERLAP_WORDS;
    }

    return chunks;
}

// ── Text extraction ───────────────────────────────────────────────────────────

const TEXT_MIME_TYPES = new Set([
    'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/css',
    'text/javascript', 'text/typescript', 'text/xml',
    'application/json', 'application/xml',
]);

async function extractText(base64Data, mimeType, geminiModel) {
    if (TEXT_MIME_TYPES.has(mimeType) || mimeType.startsWith('text/')) {
        return Buffer.from(base64Data, 'base64').toString('utf8');
    }

    // PDF, images, Office docs → Gemini multimodal OCR
    const result = await geminiModel.generateContent({
        contents: [{
            role: 'user',
            parts: [
                { inlineData: { data: base64Data, mimeType } },
                {
                    text: 'Extract ALL text content from this document. '
                        + 'Output raw text only — no commentary, no formatting descriptions, no JSON. '
                        + 'Preserve paragraph structure with line breaks.',
                },
            ],
        }],
    });

    const candidate = result.response.candidates?.[0];
    if (!candidate) throw new Error('Gemini returned no candidate during text extraction');
    return candidate.content.parts[0].text;
}

// ── Ingestion ─────────────────────────────────────────────────────────────────

/**
 * Full ingestion pipeline for a single document.
 *
 * @param {object}  opts
 * @param {string}  opts.userId
 * @param {string}  opts.dbUserId      Sequelize User.id (for Document row)
 * @param {string}  opts.fileName
 * @param {string}  opts.base64Data
 * @param {string}  opts.mimeType
 * @param {object}  opts.geminiModel   Vertex AI GenerativeModel instance
 * @returns {Promise<{ docId: string, chunkCount: number }>}
 */
export async function ingestDocument({ userId, dbUserId, fileName, base64Data, mimeType, geminiModel }) {
    const docId = randomUUID();
    console.log(`[rag] Ingesting "${fileName}" (docId: ${docId}, user: ${userId})...`);

    // 1. Extract text
    const rawText = await extractText(base64Data, mimeType, geminiModel);
    if (!rawText?.trim()) throw new Error('Could not extract any text from the document');

    // 2. Chunk
    const textChunks = chunkText(rawText);
    console.log(`[rag] Split into ${textChunks.length} chunks`);

    // 3. Embed
    const vectors = await embed(textChunks);
    const chunkIds = textChunks.map((_, i) => `${docId}_chunk_${i}`);

    // 4. Save chunk text to GCS
    await Promise.all(
        textChunks.map((text, i) => saveChunk(userId, chunkIds[i], { text, fileName, docId }))
    );
    console.log(`[rag] ${textChunks.length} chunks saved to GCS`);

    // 5. Upsert vectors to Vector Search
    const datapoints = textChunks.map((_, i) => ({
        id: chunkIds[i],
        vector: vectors[i],
        docId,
    }));
    await upsertDatapoints(userId, datapoints);
    console.log(`[rag] ${textChunks.length} vectors upserted to Vector Search`);

    // 6. Save doc metadata to GCS
    await saveDocumentMeta(userId, { docId, fileName, mimeType, chunkIds });

    // 7. Save doc record to CockroachDB
    if (dbUserId) {
        await Document.create({ id: docId, fileName, mimeType, chunkIds, userId: dbUserId });
    }

    console.log(`[rag] ✅ Ingestion complete — "${fileName}" (${textChunks.length} chunks)`);
    return { docId, chunkCount: textChunks.length };
}

// ── Retrieval ─────────────────────────────────────────────────────────────────

/**
 * Retrieve relevant chunks and return a formatted context block.
 * Returns null if no documents are indexed for the user.
 *
 * @param {string} userId
 * @param {string} queryText
 * @returns {Promise<string|null>}
 */
export async function retrieveContext(userId, queryText) {
    const queryVector = await embedQuery(queryText);
    const neighbors = await findNeighbors(userId, queryVector, 5);

    if (!neighbors.length) return null;

    const chunkIds = neighbors.map(n => n.datapointId);
    const chunks = await getChunks(userId, chunkIds);

    if (!chunks.length) return null;

    const sources = chunks.map((chunk, i) =>
        `[Source ${i + 1} — ${chunk.fileName}]\n${chunk.text}`
    );

    return [
        '== RELEVANT DOCUMENT CONTEXT ==',
        'The following excerpts are from documents the user has uploaded.',
        'Use them to answer the question. Cite the source file name when referencing them.',
        '',
        ...sources.flatMap((s, i) => (i < sources.length - 1 ? [s, '---'] : [s])),
        '',
    ].join('\n');
}

// ── Document management ───────────────────────────────────────────────────────

/**
 * Delete a document — removes vectors, GCS chunks, GCS metadata, and DB record.
 * @param {string} userId
 * @param {string} docId
 */
export async function deleteDocument(userId, docId) {
    const meta = await getDocumentMeta(userId, docId);
    if (!meta) throw new Error(`Document ${docId} not found`);

    await removeDatapoints(meta.chunkIds);
    await deleteChunks(userId, meta.chunkIds);
    await deleteDocumentMeta(userId, docId);

    // Remove from DB (ignore if not found — some docs may pre-date DB)
    await Document.destroy({ where: { id: docId } }).catch(() => { });

    console.log(`[rag] Deleted "${meta.fileName}" (${meta.chunkIds.length} chunks removed)`);
    return { fileName: meta.fileName, chunksRemoved: meta.chunkIds.length };
}

/**
 * List all documents (from GCS metadata for backwards compat).
 * @param {string} userId
 */
export { listDocumentsGCS as listDocuments };
