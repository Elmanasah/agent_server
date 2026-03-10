import express from 'express';
import cors from 'cors';
import { Agent } from './agent.js';
import config from './config.js';
import morgan from 'morgan';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleAuth } from 'google-auth-library';
import helmet from 'helmet';
import compression from 'compression';
import healthRoutes from './routes/health.routes.js';
import chatRoutes from './routes/chat.routes.js';
import errorHandler from './middlewares/errorHandler.js';
import AppError from './utils/AppError.js';
import logger from './utils/logger.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const allowedOrigins = [
    'https://elmanasah.app',
    'https://elmanasah.pages.dev',
    "https://agent.ibrahim-hemdan.com",
    'http://localhost:5173', // Allow local development
];

app.use(
    cors({
        origin: function (origin, callback) {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);

            const isAllowed =
                allowedOrigins.includes(origin) ||
                /^https:\/\/.*\.elmanasah\.pages\.dev$/.test(origin);

            if (isAllowed) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
    }),
);
app.use(express.json());
app.use(morgan('dev')); // Standard request logging
app.use(helmet());
app.use(compression());

// Mount the routes
app.use('/', healthRoutes);
app.use('/', chatRoutes);

// Handle unhandled routes (HTTP)
app.use((req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handler
app.use(errorHandler);

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

    // Trigger auth immediately upon connection
    authInProgress = true;
    logger.info("[proxy] Client connection initiated. Retrieving GCP token...");

    getGcpAccessToken().then((accessToken) => {
        // Automatically connect to the configured GCP endpoint
        const serviceUrl = DEFAULT_SERVICE_URL;
        logger.info(`[proxy] Auto-Auth OK → connecting to ${serviceUrl}`);

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
                        logger.debug("[proxy →GCP setup]", { payload: parsed });
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
            if (DEBUG) logger.debug("[proxy ←GCP]", { preview: str.slice(0, 200) });
            if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(str);
            }
        });

        serverWs.on("close", (code, reason) => {
            logger.info(`[proxy] GCP closed ${code} ${reason}`);
            if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.close(1000, "Upstream closed");
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
