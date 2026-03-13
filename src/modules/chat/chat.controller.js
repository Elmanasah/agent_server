/**
 * src/modules/chat/chat.controller.js
 */

import { createSession, getSession, appendTurn } from '../../services/session.service.js';
import { getOrCreateAgent, evictAgent } from '../../services/agent.service.js';
import { retrieveContext } from '../../services/rag.service.js';
import config from '../../config/index.js';

/**
 * POST /chat
 */
export async function chat(req, res, next) {
    const { message, attachments, userId, sessionId: reqSessionId } = req.body;

    if (!message && (!attachments || attachments.length === 0)) {
        return res.status(400).json({ error: 'message or attachments are required' });
    }

    try {
        // Load or create session
        let session;
        let sessionId = reqSessionId;

        if (sessionId) session = await getSession(userId, sessionId);
        if (!session) {
            session = await createSession(userId, message || 'File upload');
            sessionId = session.id;
        }

        // Build clean Vertex AI history format: [{ role, parts }]
        const cleanHistory = (session.messages || []).map(({ role, parts }) => ({ role, parts }));
        const agent = getOrCreateAgent(sessionId, cleanHistory);

        // RAG retrieval
        let ragContext = null;
        if (message?.trim() && config.ragEnabled) {
            try {
                ragContext = await retrieveContext(userId, message);
                if (ragContext) console.log(`[chat] RAG context injected (${ragContext.length} chars)`);
            } catch (ragErr) {
                console.warn('[chat] RAG failed — continuing without context:', ragErr.message);
            }
        }

        // Call Gemini
        const { reply, userParts } = await agent.sendMessage(message, attachments, ragContext);

        // Persist both turns to DB
        await appendTurn(sessionId, userParts, reply);

        res.json({ reply, sessionId });

    } catch (err) {
        next(err);
    }
}

/**
 * POST /reset
 * Clears the in-memory agent cache for a session.
 */
export function reset(req, res) {
    const { sessionId } = req.body;
    if (sessionId) evictAgent(sessionId);
    res.json({ status: 'ok', message: 'Conversation reset' });
}
