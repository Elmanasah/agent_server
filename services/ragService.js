/**
 * services/ragService.js
 *
 * Orchestrates two pipelines:
 *
 *   ingestDocument()   — file → text → chunks → embeddings → GCS + Vector Search
 *   retrieveContext()  — message → embed → findNeighbors → GCS chunk text → prompt block
 *
 * Both accept a `userId` parameter. "default" = single user today.
 * Swap in a real UID when auth is added — nothing else changes.
 */

import { randomUUID }       from 'crypto'; // built-in Node.js
import { embed, embedQuery } from './embeddingService.js';
import { upsertDatapoints, findNeighbors, removeDatapoints } from './vectorSearchService.js';
import {
    saveChunk, getChunks, deleteChunks,
    saveDocumentMeta, getDocumentMeta, listDocuments, deleteDocumentMeta,
} from './chunkStorageService.js';

// ─── Text chunking ────────────────────────────────────────────────────────────

const CHUNK_WORDS   = 400; // target chunk size in words
const OVERLAP_WORDS = 60;  // overlap between adjacent chunks

function chunkText(text) {
    const words  = text.split(/\s+/).filter(Boolean);
    const chunks = [];
    let   i      = 0;

    while (i < words.length) {
        const end   = Math.min(i + CHUNK_WORDS, words.length);
        const chunk = words.slice(i, end).join(' ');
        if (chunk.trim().length > 30) chunks.push(chunk); // skip micro-chunks
        if (end >= words.length) break;
        i += CHUNK_WORDS - OVERLAP_WORDS;
    }
    return chunks;
}

// ─── Text extraction ─────────────────────────────────────────────────────────

const TEXT_MIME_TYPES = new Set([
    'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/css',
    'text/javascript', 'text/typescript', 'text/xml',
    'application/json', 'application/xml',
]);

/**
 * Extract readable text from a base64-encoded file.
 *
 * Plain-text types are decoded directly.
 * PDFs and images are passed to Gemini multimodal for OCR + text extraction.
 *
 * @param {string} base64Data
 * @param {string} mimeType
 * @param {object} geminiModel   - the existing Vertex AI GenerativeModel instance
 * @returns {Promise<string>}
 */
async function extractText(base64Data, mimeType, geminiModel) {
    if (TEXT_MIME_TYPES.has(mimeType) || mimeType.startsWith('text/')) {
        return Buffer.from(base64Data, 'base64').toString('utf8');
    }

    // PDF, images, Word documents → Gemini multimodal extraction
    const result = await geminiModel.generateContent({
        contents: [{
            role:  'user',
            parts: [
                { inlineData: { data: base64Data, mimeType } },
                {
                    text: 'Extract ALL text content from this document. '
                        + 'Output the raw text only — no commentary, no formatting descriptions, no JSON. '
                        + 'Preserve paragraph structure with line breaks.',
                },
            ],
        }],
    });

    const candidate = result.response.candidates?.[0];
    if (!candidate) throw new Error('Gemini returned no candidate during text extraction');
    return candidate.content.parts[0].text;
}

// ─── Ingestion ────────────────────────────────────────────────────────────────

/**
 * Full ingestion pipeline for a single document.
 *
 * Steps:
 *   1. Extract text from file (direct decode or Gemini multimodal)
 *   2. Split into overlapping chunks
 *   3. Batch-embed all chunks via text-embedding-004
 *   4. Save each chunk's text to Cloud Storage
 *   5. Upsert all chunk vectors into Vertex AI Vector Search (userId-namespaced)
 *   6. Save document metadata to Cloud Storage
 *
 * @param {object}  opts
 * @param {string}  opts.userId       - "default" or real UID
 * @param {string}  opts.fileName     - shown in RAG citations
 * @param {string}  opts.base64Data   - file bytes as base64 string
 * @param {string}  opts.mimeType     - MIME type of the file
 * @param {object}  opts.geminiModel  - Vertex AI GenerativeModel instance
 * @returns {Promise<{ docId: string, chunkCount: number }>}
 */
export async function ingestDocument({ userId, fileName, base64Data, mimeType, geminiModel }) {
    const docId = randomUUID();
    console.log(`[rag] Ingesting "${fileName}" (docId: ${docId}, user: ${userId})...`);

    // 1. Extract text
    const rawText = await extractText(base64Data, mimeType, geminiModel);
    if (!rawText?.trim()) throw new Error('Could not extract any text from the document');

    // 2. Chunk
    const textChunks = chunkText(rawText);
    console.log(`[rag] Split into ${textChunks.length} chunks`);

    // 3. Embed (batched)
    const vectors = await embed(textChunks);

    // 4 + 5. Save chunks to GCS and build vector datapoints in parallel
    const chunkIds = textChunks.map((_, i) => `${docId}_chunk_${i}`);

    await Promise.all(
        textChunks.map((text, i) =>
            saveChunk(userId, chunkIds[i], { text, fileName, docId })
        )
    );
    console.log(`[rag] ${textChunks.length} chunks saved to Cloud Storage`);

    // 6. Upsert vectors to Vector Search
    const datapoints = textChunks.map((_, i) => ({
        id:     chunkIds[i],
        vector: vectors[i],
        docId,
    }));
    await upsertDatapoints(userId, datapoints);
    console.log(`[rag] ${textChunks.length} vectors upserted to Vertex AI Vector Search`);

    // 7. Save doc metadata
    await saveDocumentMeta(userId, { docId, fileName, mimeType, chunkIds });

    console.log(`[rag] ✅ Ingestion complete — "${fileName}" (${textChunks.length} chunks)`);
    return { docId, chunkCount: textChunks.length };
}

// ─── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Retrieve the most relevant document chunks for a user's query and
 * return a formatted context block ready to inject into the system prompt.
 *
 * Returns null when the user has no documents indexed — the caller
 * then proceeds with normal (non-RAG) chat with zero code changes.
 *
 * @param {string} userId
 * @param {string} queryText   - the user's message
 * @returns {Promise<string | null>}
 */
export async function retrieveContext(userId, queryText) {
    // 1. Embed the query using the RETRIEVAL_QUERY task type
    const queryVector = await embedQuery(queryText);

    // 2. Find nearest neighbours in the Vector Search index (userId-scoped)
    const neighbors = await findNeighbors(userId, queryVector, 5);

    if (!neighbors.length) return null;

    // 3. Fetch chunk texts from Cloud Storage
    const chunkIds = neighbors.map(n => n.datapointId);
    const chunks   = await getChunks(userId, chunkIds);

    if (!chunks.length) return null;

    // 4. Format as a prompt-injectable context block
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

// ─── Document management (called from routes) ─────────────────────────────────

/**
 * Delete a document — removes vectors from Vector Search and text from GCS.
 *
 * @param {string} userId
 * @param {string} docId
 */
export async function deleteDocument(userId, docId) {
    const meta = await getDocumentMeta(userId, docId);
    if (!meta) throw new Error(`Document ${docId} not found`);

    // Remove vectors from Vector Search
    await removeDatapoints(meta.chunkIds);

    // Remove chunk text files from GCS
    await deleteChunks(userId, meta.chunkIds);

    // Remove the metadata record
    await deleteDocumentMeta(userId, docId);

    console.log(`[rag] Deleted document "${meta.fileName}" (${meta.chunkIds.length} chunks removed)`);
    return { fileName: meta.fileName, chunksRemoved: meta.chunkIds.length };
}

export { listDocuments };
