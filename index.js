import express from 'express';
import cors from 'cors';
import { Agent } from './agent.js';
import config from './config.js';
import morgan from 'morgan';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleAuth } from 'google-auth-library';

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
const GCP_API_HOST = `${config.location}-aiplatform.googleapis.com`;
const DEFAULT_SERVICE_URL = `wss://${GCP_API_HOST}/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;

// Authenticate and get a short-lived token using Application Default Credentials
async function getGcpAccessToken() {
    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
}

wss.on("connection", (clientWs, req) => {
    console.log(`[proxy] New client from ${req.socket.remoteAddress}`);

    let serverWs = null;
    let authInProgress = false;
    let gcpReady = false;
    const pendingMessages = [];

    // Trigger auth immediately upon connection
    authInProgress = true;
    console.log("[proxy] Client connection initiated. Retrieving GCP token...");

    getGcpAccessToken().then((accessToken) => {
        // Automatically connect to the configured GCP endpoint
        const serviceUrl = DEFAULT_SERVICE_URL;
        console.log(`[proxy] Auto-Auth OK → connecting to ${serviceUrl}`);

        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`
        };

        serverWs = new WebSocket(serviceUrl, { headers });

        serverWs.on("open", () => {
            gcpReady = true;

            // Vertex AI REQUIRES the setup message to be the very first message.
            // We will flush the pending messages (which should contain the setup)
            for (const msg of pendingMessages) {
                try {
                    let parsed = JSON.parse(msg);
                    if (parsed.setup) {
                        // Ensure model path is correct for Vertex
                        if (parsed.setup.model === "gemini-live-2.5-flash-native-audio") {
                            parsed.setup.model = `projects/${config.projectId}/locations/${config.location}/publishers/google/models/gemini-live-2.5-flash-native-audio`;
                        }
                        console.log("[proxy →GCP setup]", JSON.stringify(parsed, null, 2));
                        serverWs.send(JSON.stringify(parsed));
                    } else {
                        serverWs.send(msg);
                    }
                } catch (err) {
                    serverWs.send(msg);
                }
            }
            pendingMessages.length = 0;
        });

        serverWs.on("message", (data) => {
            const str = data.toString();
            if (DEBUG) console.log("[proxy ←GCP]", str.slice(0, 200));
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

    }).catch((err) => {
        console.error("[proxy] Failed to get GCP Access Token:", err.message);
        clientWs.close(1008, "Internal GCP Auth Error");
    });

    clientWs.on("message", (rawData) => {
        const raw = rawData.toString();

        if (!gcpReady) {
            console.log("[proxy] GCP not ready, buffering…");
            pendingMessages.push(raw);
            return;
        }

        if (serverWs?.readyState === WebSocket.OPEN) {
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
