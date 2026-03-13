/**
 * src/websocket/proxy.js
 *
 * Gemini Live WebSocket proxy.
 * Authenticates the client, then bidirectionally bridges messages to GCP.
 *
 * @param {import('ws').WebSocketServer} wss
 */

import { WebSocket } from 'ws';
import config from '../config/index.js';

const DEFAULT_SERVICE_URL = `wss://${config.gcpApiHost}/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;

export function attachProxy(wss) {
    wss.on('connection', (clientWs) => {
        let serverWs = null;
        let isAuthenticated = false;
        let gcpReady = false;
        const pendingMessages = [];

        // Kick unauthenticated clients after 10 s
        const authTimeout = setTimeout(() => {
            if (!isAuthenticated) clientWs.close(1008, 'Authentication timeout');
        }, 10_000);

        clientWs.on('message', (rawData) => {
            const raw = rawData.toString();

            // ── Step 1: Authenticate ──────────────────────────────────────────
            if (!isAuthenticated) {
                try {
                    const authData = JSON.parse(raw);
                    if (!authData.bearer_token) {
                        clientWs.close(1008, 'Bearer token missing');
                        return;
                    }

                    clearTimeout(authTimeout);
                    isAuthenticated = true;

                    const serviceUrl = authData.service_url || DEFAULT_SERVICE_URL;
                    const headers = { 'Content-Type': 'application/json' };

                    if (serviceUrl.includes('aiplatform.googleapis.com')) {
                        headers['Authorization'] = `Bearer ${authData.bearer_token}`;
                    }

                    serverWs = new WebSocket(serviceUrl, { headers });

                    serverWs.on('open', () => {
                        gcpReady = true;
                        if (clientWs.readyState === WebSocket.OPEN) {
                            clientWs.send(JSON.stringify({ proxy_ready: true }));
                        }
                        // Flush any messages buffered while GCP was connecting
                        for (const msg of pendingMessages) serverWs.send(msg);
                        pendingMessages.length = 0;
                    });

                    serverWs.on('message', (data) => {
                        if (clientWs.readyState === WebSocket.OPEN) {
                            clientWs.send(data.toString());
                        }
                    });

                    serverWs.on('close', (code, reason) => {
                        if (clientWs.readyState === WebSocket.OPEN) {
                            clientWs.close(code, reason || 'Upstream closed');
                        }
                    });

                    serverWs.on('error', (err) => {
                        console.error('[proxy] GCP WS error:', err.message);
                        if (clientWs.readyState === WebSocket.OPEN) {
                            clientWs.close(1011, `Upstream error: ${err.message}`);
                        }
                    });

                } catch {
                    clientWs.close(1008, 'Invalid auth message');
                }
                return;
            }

            // ── Step 2: Proxy messages ────────────────────────────────────────
            if (!gcpReady) {
                pendingMessages.push(raw);
                return;
            }

            if (serverWs?.readyState === WebSocket.OPEN) {
                serverWs.send(raw);
            }
        });

        clientWs.on('close', () => {
            clearTimeout(authTimeout);
            if (serverWs?.readyState === WebSocket.OPEN) serverWs.close();
        });

        clientWs.on('error', (err) => console.error('[proxy] Client WS error:', err.message));
    });

    console.log('[proxy] Gemini Live WebSocket proxy attached');
}
