import express          from 'express';
import cors             from 'cors';
import { Agent }        from './agent.js';
import config           from './config.js';
import morgan           from 'morgan';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleAuth }   from 'google-auth-library';
import fetch            from 'node-fetch';

import { ingestDocument, retrieveContext, deleteDocument, listDocuments }
    from './services/ragService.js';
import { createSession, getSession, appendTurn, listSessions, deleteSession }
    from './services/sessionService.js';

const app    = express();
const server = createServer(app);
const wss    = new WebSocketServer({ server });

app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://agent.elmanasah.app'],
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));

// ─── In-memory agent cache ────────────────────────────────────────────────────
// Each live session keeps its own Agent instance so Gemini's in-memory context
// stays hot. On a cache miss (server restart), the Agent is rebuilt from the
// full GCS history — Gemini replays it and immediately remembers everything.
//
// SCALE NOTE: For multi-instance Cloud Run, remove this cache entirely and
// always reconstruct the Agent from GCS history. The extra GCS read (~50ms)
// is acceptable and guarantees consistency across instances.
const agentCache = new Map(); // sessionId → Agent

function getOrCreateAgent(sessionId, history = []) {
    if (!agentCache.has(sessionId)) {
        agentCache.set(sessionId, new Agent('You are a helpful AI assistant.', history));
    }
    return agentCache.get(sessionId);
}

// ─── POST /chat ───────────────────────────────────────────────────────────────
app.post('/chat', async (req, res) => {
    const { message, attachments } = req.body;
    const userId    = req.body.userId    ?? 'default';
    let   sessionId = req.body.sessionId ?? null;

    if (!message && (!attachments || attachments.length === 0)) {
        return res.status(400).json({ error: 'message or attachments are required' });
    }

    try {
        // Load existing session or create a new one
        let session;
        if (sessionId) session = await getSession(userId, sessionId);
        if (!session) {
            session   = await createSession(userId, message || 'File upload');
            sessionId = session.sessionId;
        }

        // Strip timestamp — Vertex AI history only accepts { role, parts }
        const cleanHistory = session.messages.map(({ role, parts }) => ({ role, parts }));
        const agent = getOrCreateAgent(sessionId, cleanHistory);

        // RAG retrieval
        let ragContext = null;
        if (message?.trim() && config.vectorSearchIndexId) {
            try {
                ragContext = await retrieveContext(userId, message);
                if (ragContext) console.log(`[chat] RAG context injected (${ragContext.length} chars)`);
            } catch (ragErr) {
                console.warn('[chat] RAG failed — continuing without context:', ragErr.message);
            }
        }

        // Call Gemini
        const { reply, userParts } = await agent.sendMessage(message, attachments, ragContext);

        // Persist both turns to GCS
        await appendTurn(userId, sessionId, userParts, reply);

        res.json({ reply, sessionId });

    } catch (err) {
        console.error('[chat]', err.message);
        res.status(500).json({ error: 'Failed to get a response from the AI agent' });
    }
});

// ─── POST /reset ──────────────────────────────────────────────────────────────
app.post('/reset', (req, res) => {
    const { sessionId } = req.body;
    if (sessionId) agentCache.delete(sessionId);
    res.json({ status: 'ok', message: 'Conversation reset' });
});

// ─── GET /sessions ────────────────────────────────────────────────────────────
// List all past sessions for the history sidebar
app.get('/sessions', async (req, res) => {
    const userId = req.query.userId ?? 'default';
    try {
        const sessions = await listSessions(userId);
        res.json({ sessions });
    } catch (err) {
        console.error('[sessions]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /sessions/:sessionId ─────────────────────────────────────────────────
// Load full message history for a session (to display in the chat window)
app.get('/sessions/:sessionId', async (req, res) => {
    const userId = req.query.userId ?? 'default';
    try {
        const session = await getSession(userId, req.params.sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        res.json({ session });
    } catch (err) {
        console.error('[sessions/get]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── DELETE /sessions/:sessionId ──────────────────────────────────────────────
app.delete('/sessions/:sessionId', async (req, res) => {
    const userId = req.query.userId ?? 'default';
    const { sessionId } = req.params;
    try {
        agentCache.delete(sessionId);
        await deleteSession(userId, sessionId);
        res.json({ status: 'ok' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /ingest ─────────────────────────────────────────────────────────────
app.post('/ingest', async (req, res) => {
    const { fileName, mimeType, data } = req.body;
    const userId = req.body.userId ?? 'default';
    if (!fileName || !mimeType || !data) {
        return res.status(400).json({ error: 'fileName, mimeType, and data are required' });
    }
    try {
        const { model } = await import('./vertex.js');
        const { docId, chunkCount } = await ingestDocument({
            userId, fileName, base64Data: data, mimeType, geminiModel: model,
        });
        res.json({ status: 'ok', docId, fileName, chunkCount });
    } catch (err) {
        console.error('[ingest]', err.message);
        res.status(500).json({ error: `Ingestion failed: ${err.message}` });
    }
});

// ─── GET /documents ───────────────────────────────────────────────────────────
app.get('/documents', async (req, res) => {
    const userId = req.query.userId ?? 'default';
    try {
        res.json({ documents: await listDocuments(userId) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── DELETE /documents/:docId ─────────────────────────────────────────────────
app.delete('/documents/:docId', async (req, res) => {
    const userId = req.query.userId ?? 'default';
    try {
        res.json({ status: 'ok', ...await deleteDocument(userId, req.params.docId) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /token ───────────────────────────────────────────────────────────────
const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });

app.get('/token', async (_req, res) => {
    try {
        const client = await auth.getClient();
        res.json({ token: (await client.getAccessToken()).token });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get access token' });
    }
});

// ─── GET /config ──────────────────────────────────────────────────────────────
app.get('/config', (_req, res) => {
    res.json({
        projectId: process.env.GOOGLE_CLOUD_PROJECT,
        location:  process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    });
});

// ─── GET / ────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.json({ status: 'ok', message: 'AI Agent is running 🚀' }));

// ─── POST /generate-image ─────────────────────────────────────────────────────
app.post('/generate-image', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
    try {
        const client   = await auth.getClient();
        const project  = await auth.getProjectId();
        const { token } = await client.getAccessToken();
        const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
        const url      = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/imagen-3.0-generate-001:predict`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1 } }),
        });
        if (!response.ok) {
            const e = await response.json();
            throw new Error(e.error?.message || 'Image generation failed');
        }
        const data = await response.json();
        res.json({ imageUrl: `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`, prompt });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Gemini Live WebSocket Proxy — unchanged ──────────────────────────────────
const DEFAULT_SERVICE_URL = `wss://${process.env.GCP_API_HOST || 'us-central1-aiplatform.googleapis.com'}/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;

wss.on('connection', (clientWs, req) => {
    let serverWs = null, isAuthenticated = false, gcpReady = false;
    const pendingMessages = [];
    const authTimeout = setTimeout(() => { if (!isAuthenticated) clientWs.close(1008, 'Authentication timeout'); }, 10_000);

    clientWs.on('message', (rawData) => {
        const raw = rawData.toString();
        if (!isAuthenticated) {
            try {
                const authData = JSON.parse(raw);
                if (!authData.bearer_token) { clientWs.close(1008, 'Bearer token missing'); return; }
                clearTimeout(authTimeout);
                isAuthenticated = true;
                const serviceUrl = authData.service_url || DEFAULT_SERVICE_URL;
                const headers = { 'Content-Type': 'application/json' };
                if (serviceUrl.includes('aiplatform.googleapis.com')) headers['Authorization'] = `Bearer ${authData.bearer_token}`;
                serverWs = new WebSocket(serviceUrl, { headers });
                serverWs.on('open', () => {
                    gcpReady = true;
                    if (clientWs.readyState === WebSocket.OPEN) clientWs.send(JSON.stringify({ proxy_ready: true }));
                    for (const msg of pendingMessages) serverWs.send(msg);
                    pendingMessages.length = 0;
                });
                serverWs.on('message', (data) => { if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data.toString()); });
                serverWs.on('close', (code, reason) => { if (clientWs.readyState === WebSocket.OPEN) clientWs.close(code, reason || 'Upstream closed'); });
                serverWs.on('error', (err) => { if (clientWs.readyState === WebSocket.OPEN) clientWs.close(1011, `Upstream error: ${err.message}`); });
            } catch { clientWs.close(1008, 'Invalid auth message'); }
            return;
        }
        if (!gcpReady) { pendingMessages.push(raw); return; }
        if (serverWs?.readyState === WebSocket.OPEN) serverWs.send(raw);
    });
    clientWs.on('close', () => { clearTimeout(authTimeout); if (serverWs?.readyState === WebSocket.OPEN) serverWs.close(); });
    clientWs.on('error', (err) => console.error('[proxy] Client error:', err.message));
});

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(config.port, () => {
    console.log(`✅ Server   running at http://localhost:${config.port}`);
    console.log(`✅ Proxy    running at ws://localhost:${config.port}`);
    console.log(`✅ RAG      ${config.vectorSearchIndexId ? 'enabled ✓' : 'disabled — run scripts/setup-rag.js'}`);
    console.log(`✅ Sessions persisted to gs://${config.gcsBucketName}/sessions/`);
});
