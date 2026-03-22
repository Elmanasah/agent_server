/**
 * src/modules/chat/chat.controller.js
 *
 * SSE Streaming Chat Controller.
 *
 * POST /api/v1/chat
 * Streams typed events to the client using Server-Sent Events (SSE).
 *
 * Event types:
 *   { type: "token",       text: "..." }
 *   { type: "tool_start",  tool: "generate_image", args: {...} }
 *   { type: "tool_result", tool: "generate_image", result: { image: {...} } }
 *   { type: "tool_result", tool: "render_canvas",  result: { canvas: {...} } }
 *   { type: "tool_result", tool: "render_diagram", result: { diagram: {...} } }
 *   { type: "tool_result", tool: "render_math",    result: { math: {...} } }
 *   { type: "error",       message: "..." }
 *   { type: "done",        sessionId: "..." }
 */

import { createSession, getSession, appendTurn } from '../sessions/session.service.js';
import { getOrCreateAgent, evictAgent } from '../agents/agent.service.js';
import config from '../../config/index.js';

// ── SSE helper ────────────────────────────────────────────────────────────────

function sendEvent(res, data) {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ── POST /chat ─────────────────────────────────────────────────────────────────

export async function chat(req, res, next) {
    const { message, attachments, sessionId: reqSessionId } = req.body;
    const userId = req.user.id;
    const user = req.user; // Full user object from verifyToken middleware

    if (!message && (!attachments || attachments.length === 0)) {
        return res.status(400).json({ error: 'message or attachments are required' });
    }

    // ── Set up SSE stream ─────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Heartbeat to prevent proxy timeouts (every 15 s)
    const heartbeat = setInterval(() => {
        if (!res.writableEnded) res.write(': heartbeat\n\n');
    }, 15_000);

    const cleanup = () => clearInterval(heartbeat);
    req.on('close', cleanup);

    try {
        // ── Load or create session ────────────────────────────────────────────
        let session;
        let sessionId = reqSessionId;

        if (sessionId) session = await getSession(userId, sessionId);
        if (!session) {
            session = await createSession(userId, message || 'File upload');
            sessionId = session.id;
        }

        const cleanHistory = (session.messages || []).map(({ role, parts }) => ({ role, parts }));
        const agent = getOrCreateAgent(sessionId, cleanHistory, user);

        // ── RAG retrieval (still useful as a pre-fetch hint, tools can also trigger it) ──
        let ragContext = null;
        if (message?.trim() && config.ragEnabled) {
            try {
                const { retrieveContext } = await import('../rag/rag.service.js');
                ragContext = await retrieveContext(userId, message);
                if (ragContext) console.log(`[chat] RAG pre-fetch injected (${ragContext.length} chars)`);
            } catch (ragErr) {
                console.warn('[chat] RAG pre-fetch failed — agent tool can retry:', ragErr.message);
            }
        }

        // ── Run agent with streaming event callback ────────────────────────────
        const { reply, userParts, toolResults } = await agent.sendMessage(
            message,
            attachments || [],
            ragContext,
            (event) => sendEvent(res, event),   // stream events live
        );

        // Persist turn to DB
        await appendTurn(sessionId, userParts, reply);

        // Send done event
        sendEvent(res, { type: 'done', sessionId, toolResults });

    } catch (err) {
        console.error('[chat] Error:', err.message);
        sendEvent(res, { type: 'error', message: err.message || 'Something went wrong' });
    } finally {
        cleanup();
        if (!res.writableEnded) res.end();
    }
}

// ── POST /reset ────────────────────────────────────────────────────────────────

export function reset(req, res) {
    const { sessionId } = req.body;
    if (sessionId) evictAgent(sessionId);
    res.json({ status: 'ok', message: 'Conversation reset' });
}
