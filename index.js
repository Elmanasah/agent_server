import express from 'express';
import cors from 'cors';
import { Agent } from './agent.js';
import config from './config.js';
import morgan from 'morgan';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
}));


app.use(express.json());
app.use(morgan('dev')); // Standard request logging

// ─── Agent (shared stateful instance) ─────────────────────────────────────────
let agent = new Agent('You are a helpful AI assistant.');
app.post("/add-doc", async (req, res) => {
  const { text } = req.body;
  const embedding = await createEmbedding(text);
  addDocument({
    text,
    embedding
  });
  res.json({ status: "stored" });
});
// POST /chat → send a message to the agent
app.post('/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'message field is required' });
    }
    try {
        const reply = await agent.sendMessage(message);
        res.json({ reply });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to get a response from the AI agent' });
    }
});

// POST /reset → clear conversation history by creating a fresh agent
app.post('/reset', (_req, res) => {
    agent = new Agent('You are a helpful AI assistant.');
    res.json({ status: 'ok', message: 'Conversation reset' });
});

// GET / → health check
app.get('/', (_req, res) => {
    res.json({ status: 'ok', message: 'AI Agent is running 🚀' });
});

// ─── Gemini Live Proxy (WebSocket) ────────────────────────────────────────────
const DEBUG = process.env.DEBUG === "true";
const GCP_API_HOST = process.env.GCP_API_HOST || "us-central1-aiplatform.googleapis.com";
const DEFAULT_SERVICE_URL = `wss://${GCP_API_HOST}/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;

wss.on("connection", (clientWs, req) => {
    console.log(`[proxy] New client from ${req.socket.remoteAddress}`);

    let serverWs = null;
    let isAuthenticated = false;
    let gcpReady = false;
    const pendingMessages = [];

    const authTimeout = setTimeout(() => {
        if (!isAuthenticated) {
            console.log("[proxy] Auth timeout – closing client");
            clientWs.close(1008, "Authentication timeout");
        }
    }, 10_000);

    clientWs.on("message", (rawData) => {
        const raw = rawData.toString();

        if (!isAuthenticated) {
            try {
                const authData = JSON.parse(raw);
                if (!authData.bearer_token) {
                    clientWs.close(1008, "Bearer token missing");
                    return;
                }

                clearTimeout(authTimeout);
                isAuthenticated = true;

                const serviceUrl = authData.service_url || DEFAULT_SERVICE_URL;
                console.log(`[proxy] Auth OK → connecting to ${serviceUrl}`);

                const isVertex = serviceUrl.includes("aiplatform.googleapis.com");
                const headers = { "Content-Type": "application/json" };
                if (isVertex) {
                    headers["Authorization"] = `Bearer ${authData.bearer_token}`;
                }

                serverWs = new WebSocket(serviceUrl, { headers });

                serverWs.on("open", () => {
                    gcpReady = true;
                    console.log(`[proxy] GCP open — flushing ${pendingMessages.length} buffered msg(s)`);

                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(JSON.stringify({ proxy_ready: true }));
                    }

                    for (const msg of pendingMessages) {
                        console.log("[proxy →GCP flush]", msg.slice(0, 300));
                        serverWs.send(msg);
                    }
                    pendingMessages.length = 0;
                });

                serverWs.on("message", (data) => {
                    const str = data.toString();
                    console.log("[proxy ←GCP]", str.slice(0, 200));
                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(str);
                    }
                });

                serverWs.on("close", (code, reason) => {
                    console.log(`[proxy] GCP closed ${code} ${reason}`);
                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.close(1000, "Upstream closed");
                    }
                });

                serverWs.on("error", (err) => {
                    console.error("[proxy] GCP error:", err.message);
                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.close(1011, `Upstream error: ${err.message}`);
                    }
                });

            } catch (err) {
                console.error("[proxy] Bad auth message:", err.message);
                clientWs.close(1008, "Invalid auth message");
            }
            return;
        }

        if (!gcpReady) {
            console.log("[proxy] GCP not ready, buffering…");
            pendingMessages.push(raw);
            return;
        }

        if (serverWs?.readyState === WebSocket.OPEN) {
            const parsed = JSON.parse(raw);
            if (parsed.setup) console.log("[proxy →GCP setup]", JSON.stringify(parsed, null, 2));
            serverWs.send(raw);
        }
    });

    clientWs.on("close", (code, reason) => {
        console.log(`[proxy] Client disconnected ${code} ${reason}`);
        clearTimeout(authTimeout);
        if (serverWs?.readyState === WebSocket.OPEN) serverWs.close();
    });

    clientWs.on("error", (err) => {
        console.error("[proxy] Client error:", err.message);
    });
});

server.listen(config.port, () => {
    console.log(`✅ Server running at http://localhost:${config.port}`);
    console.log(`✅ Proxy running at ws://localhost:${config.port}`);
});
