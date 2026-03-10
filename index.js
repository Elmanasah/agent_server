import express from 'express';
import cors from 'cors';
import { Agent } from './agent.js';
import config from './config.js';
import morgan from 'morgan';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch'; // Ensure node-fetch is available if node < 18, but express 5+ usually fine with global fetch

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });


app.use(
    cors({
        origin: function (origin, callback) {
            // Reflect the exact origin of the incoming request
            // This allows all origins but still permits credentials
            callback(null, origin || '*');
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
    })
);
app.use(express.json());
app.use(morgan('dev')); // Standard request logging
app.use(helmet());
app.use(compression());

// Mount the routes
app.use('/', healthRoutes);
app.use('/', chatRoutes);

// POST /chat → send a message to the agent
app.post('/chat', async (req, res) => {
    const { message, attachments } = req.body;
    if (!message && (!attachments || attachments.length === 0)) {
        return res.status(400).json({ error: 'message or attachments are required' });
    }
    try {
        const reply = await agent.sendMessage(message, attachments);
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

// GET /token → get a fresh Google Cloud access token
app.get('/token', async (_req, res) => {
    try {
        const client = await auth.getClient();
        const tokenSource = await client.getAccessToken();
        res.json({ token: tokenSource.token });
    } catch (err) {
        console.error('[Token Error]:', err.message);
        res.status(500).json({ error: 'Failed to get access token' });
    }
});

// GET /config → get GCP project and location
app.get('/config', (_req, res) => {
    res.json({
        projectId: process.env.GOOGLE_CLOUD_PROJECT,
        location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
    });
});

// GET / → health check
app.get('/', (_req, res) => {
    res.json({ status: 'ok', message: 'AI Agent is running 🚀' });
});

// ─── Image Generation (Vertex AI Imagen) ──────────────────────────────────────
const auth = new GoogleAuth({
  scopes: 'https://www.googleapis.com/auth/cloud-platform',
});

app.post('/generate-image', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        const client = await auth.getClient();
        const project = await auth.getProjectId();
        const tokenSource = await client.getAccessToken();
        const accessToken = tokenSource.token;

        const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
        const model = 'imagen-3.0-generate-001'; // Falling back to 3.0 if 4.0 fast isn't available, but using user's suggested path structure
        const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:predict`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                instances: [{ prompt }],
                parameters: { sampleCount: 1 }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Vertex AI Image Generation failed');
        }

        const data = await response.json();
        const base64Image = data.predictions[0].bytesBase64Encoded;
        
        res.json({ 
            imageUrl: `data:image/png;base64,${base64Image}`,
            prompt: prompt
        });
    } catch (err) {
        console.error('[ImageGen Error]:', err.message);
        res.status(500).json({ error: err.message });
    }
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
    logger.info(`[proxy] New client from ${req.socket.remoteAddress}`);

    let serverWs = null;
    let authInProgress = false;
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
                        serverWs.send(msg);
                    }
                    pendingMessages.length = 0;
                });

                serverWs.on("message", (data) => {
                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(data.toString());
                    }
                });

                serverWs.on("close", (code, reason) => {
                    console.log(`[proxy] GCP closed | code: ${code} | reason: ${reason}`);
                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.close(code, reason || "Upstream closed");
                    }
                });

                serverWs.on("error", (err) => {
                    console.error("[proxy] GCP connection error:", err);
                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.close(1011, `Upstream error: ${err.message}`);
                    }
                });

        serverWs.on("error", (err) => {
            logger.error(`[proxy] GCP error: ${err.message}`);
            if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.close(1011, `Upstream error: ${err.message}`);
            }
        });

    }).catch((err) => {
        logger.error(`[proxy] Failed to get GCP Access Token: ${err.message}`);
        clientWs.close(1008, "Internal GCP Auth Error");
    });

    clientWs.on("message", (rawData) => {
        const raw = rawData.toString();

        if (!gcpReady) {
            logger.debug("[proxy] GCP not ready, buffering…");
            pendingMessages.push(raw);
            return;
        }

        if (serverWs?.readyState === WebSocket.OPEN) {
            serverWs.send(raw);
        }
    });

    clientWs.on("close", (code, reason) => {
        logger.info(`[proxy] Client disconnected ${code} ${reason}`);
        if (serverWs?.readyState === WebSocket.OPEN) serverWs.close();
    });

    clientWs.on("error", (err) => {
        logger.error(`[proxy] Client error: ${err.message}`);
    });
});

// Explicit WebSocket CORS and Upgrade Handler
server.on('upgrade', (request, socket, head) => {
    const origin = request.headers.origin;

    // In production, enforce origin checks for WebSockets
    if (config.NODE_ENV === 'production' && origin) {
        const allowed = [
            'https://agent.elmanasah.app',
            'https://agent-front-2lo.pages.dev',
            'https://agent.ibrahim-hemdan.com'
        ];

        let isAllowed = allowed.includes(origin) || origin.endsWith('.elmanasah.pages.dev');
        if (!isAllowed) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

const serverInstance = server.listen(config.port, () => {
    logger.info(`✅ Server running at http://localhost:${config.port}`);
    logger.info(`✅ Proxy running at ws://localhost:${config.port}`);
});

process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    serverInstance.close(() => {
        logger.info('HTTP/WS server closed.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received. Shutting down gracefully...');
    serverInstance.close(() => {
        logger.info('HTTP/WS server closed.');
        process.exit(0);
    });
});
