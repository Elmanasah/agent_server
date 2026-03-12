/**
 * services/sessionService.js
 *
 * Persists chat sessions to Cloud Storage.
 *
 * GCS layout:
 *   sessions/{userId}/{sessionId}.json
 *     {
 *       sessionId, userId, title,
 *       createdAt, updatedAt,
 *       messages: [{ role: 'user'|'model', parts: [{ text }], timestamp }]
 *     }
 *
 * The `messages` array is in Vertex AI history format so it can be passed
 * directly to model.startChat({ history }) to restore full context.
 *
 * SCALE NOTE: userId = 'default' now. Swap in real UID when auth is added.
 * GCS path already carries userId so isolation is automatic.
 */

import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';
import config from '../config.js';

const storage = new Storage({ projectId: config.projectId });
const bucket  = () => storage.bucket(config.gcsBucketName);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sessionPath(userId, sessionId) {
    return `sessions/${userId}/${sessionId}.json`;
}

async function readJSON(filePath) {
    try {
        const [contents] = await bucket().file(filePath).download();
        return JSON.parse(contents.toString('utf8'));
    } catch (err) {
        if (err.code === 404) return null;
        throw err;
    }
}

async function writeJSON(filePath, data) {
    await bucket().file(filePath).save(
        JSON.stringify(data, null, 2),
        { contentType: 'application/json', resumable: false }
    );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a brand-new session and save it.
 *
 * @param {string} userId
 * @param {string} firstMessage  - used to auto-generate the session title
 * @returns {Promise<object>}    session object
 */
export async function createSession(userId, firstMessage = 'New conversation') {
    const sessionId = randomUUID();
    const title     = firstMessage.slice(0, 60).trim() || 'New conversation';
    const now       = new Date().toISOString();

    const session = {
        sessionId,
        userId,
        title,
        createdAt: now,
        updatedAt: now,
        messages:  [],   // Vertex AI history format
    };

    await writeJSON(sessionPath(userId, sessionId), session);
    console.log(`[session] Created session "${title}" (${sessionId})`);
    return session;
}

/**
 * Load a session. Returns null if not found.
 *
 * @param {string} userId
 * @param {string} sessionId
 * @returns {Promise<object|null>}
 */
export async function getSession(userId, sessionId) {
    return readJSON(sessionPath(userId, sessionId));
}

/**
 * Append a user turn + model reply to a session and save.
 * Both are stored in Vertex AI `history` format.
 *
 * @param {string}   userId
 * @param {string}   sessionId
 * @param {object[]} userParts    - [{ text }, { inlineData }]  (what was sent)
 * @param {string}   modelReply   - plain text response from the model
 */
export async function appendTurn(userId, sessionId, userParts, modelReply) {
    const session = await getSession(userId, sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const now = new Date().toISOString();

    // Store only text parts in history (base64 attachments are too large to persist)
    const textOnlyParts = userParts.filter(p => p.text);

    session.messages.push(
        { role: 'user',  parts: textOnlyParts, timestamp: now },
        { role: 'model', parts: [{ text: modelReply }], timestamp: now }
    );
    session.updatedAt = now;

    await writeJSON(sessionPath(userId, sessionId), session);
}

/**
 * List all sessions for a user, sorted newest first.
 *
 * @param {string} userId
 * @returns {Promise<object[]>}  array of session objects (messages omitted for speed)
 */
export async function listSessions(userId) {
    const [files] = await bucket().getFiles({ prefix: `sessions/${userId}/` });

    const sessions = await Promise.all(
        files.map(async (file) => {
            try {
                const [contents] = await file.download();
                const session = JSON.parse(contents.toString('utf8'));
                // Return metadata only — don't send full message history in list
                return {
                    sessionId: session.sessionId,
                    title:     session.title,
                    createdAt: session.createdAt,
                    updatedAt: session.updatedAt,
                    messageCount: session.messages?.length ?? 0,
                };
            } catch {
                return null;
            }
        })
    );

    return sessions
        .filter(Boolean)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/**
 * Delete a session.
 *
 * @param {string} userId
 * @param {string} sessionId
 */
export async function deleteSession(userId, sessionId) {
    await bucket()
        .file(sessionPath(userId, sessionId))
        .delete({ ignoreNotFound: true });
}
