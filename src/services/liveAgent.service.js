/**
 * src/services/liveAgent.service.js
 *
 * Manages per-connection state for the Live Audio Agent (WebSocket).
 *
 * Each browser WebSocket connection gets a LiveAgentSession that:
 *  1. Authenticates the user via JWT
 *  2. Detects function calls in GCP BidiGenerateContent stream
 *  3. Executes tools server-side (RAG, image gen, DB search)
 *  4. Sends tool_response frames back to GCP
 *  5. Forwards final audio/text to the browser client
 */

import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { buildSystemPrompt } from '../config/systemPrompt.js';
import { retrieveContext } from './rag.service.js';
import { generateImage } from './image.service.js';
import { searchSessions } from './sessionSearch.service.js';
import { User } from '../models/index.js';

// ── Tool executor (shared with agent.service.js logic) ────────────────────────

async function executeTool(name, args, userId) {
    console.log(`[liveAgent] tool: ${name}`, args);

    switch (name) {
        case 'search_knowledge_base': {
            if (!userId) return 'No user context for knowledge base search.';
            const context = await retrieveContext(userId, args.query).catch(() => null);
            return context || 'No relevant documents found.';
        }
        case 'search_sessions': {
            if (!userId) return 'No user context for session search.';
            const result = await searchSessions(userId, args.query).catch(() => null);
            return result || 'No relevant past conversations found.';
        }
        case 'generate_image': {
            const img = await generateImage(args.prompt);
            return `Image generated. URL: ${img.imageUrl.substring(0, 80)}...`;
        }
        case 'render_canvas':
            return `Canvas content ready: ${(args.title || 'Workspace').slice(0, 40)}`;
        case 'render_diagram':
            return `Diagram ready: ${(args.title || 'Diagram').slice(0, 40)}`;
        case 'render_math':
            return `Math plot ready: ${(args.title || 'Plot').slice(0, 40)}`;
        default:
            return `Tool "${name}" not implemented in live agent.`;
    }
}

// ── LiveAgentSession class ────────────────────────────────────────────────────

export class LiveAgentSession {
    /**
     * @param {WebSocket} clientWs - The browser WebSocket connection
     */
    constructor(clientWs) {
        this.clientWs = clientWs;
        this.userId = null;
        this.user = null;
        this.isAuthenticated = false;
    }

    /**
     * Authenticate using JWT in the first message payload.
     * @param {object} authData - { jwt_token, service_url? }
     * @returns {Promise<{ userId: string, bearerToken: string, serviceUrl: string }>}
     */
    async authenticate(authData) {
        if (!authData.jwt_token) throw new Error('jwt_token is required');

        const decoded = jwt.verify(authData.jwt_token, config.jwtSecret);
        this.userId = decoded.id;

        this.user = await User.findOne({ where: { id: this.userId } });
        if (!this.user) throw new Error('User not found');

        this.isAuthenticated = true;
        console.log(`[liveAgent] Authenticated user: ${this.user.username} (${this.userId})`);

        return {
            userId: this.userId,
            serviceUrl: authData.service_url,
            systemInstruction: buildSystemPrompt(this.user),
        };
    }

    /**
     * Process a message from GCP. Detect function calls and execute them.
     * @param {string} rawData - Raw JSON string from GCP WebSocket
     * @param {WebSocket} gcpWs - GCP WebSocket to send tool responses back to
     * @returns {boolean} - true if we handled it (tool call), false if caller should forward as-is
     */
    async handleGcpMessage(rawData, gcpWs) {
        let data;
        try { data = JSON.parse(rawData); } catch { return false; }

        // Check for function calls in server content
        const parts = data?.serverContent?.modelTurn?.parts ?? [];
        const functionCalls = parts.filter(p => p.functionCall);

        if (functionCalls.length === 0) return false; // Nothing special — let proxy forward

        console.log(`[liveAgent] Got ${functionCalls.length} function call(s)`);

        // Execute each function call and respond
        for (const part of functionCalls) {
            const { name, args } = part.functionCall;

            try {
                const output = await executeTool(name, args, this.userId);

                // Send tool_response back to GCP
                const toolResponse = {
                    tool_response: {
                        function_responses: [{
                            name,
                            response: { output: String(output) },
                        }],
                    },
                };

                if (gcpWs && gcpWs.readyState === 1 /* OPEN */) {
                    gcpWs.send(JSON.stringify(toolResponse));
                }

                // Forward tool metadata to browser client for UI updates
                if (this.clientWs.readyState === 1) {
                    this.clientWs.send(JSON.stringify({
                        tool_result: { name, output: String(output).slice(0, 200) },
                    }));
                }

            } catch (err) {
                console.error(`[liveAgent] Tool error (${name}):`, err.message);
                // Send error response back to GCP so conversation continues
                if (gcpWs && gcpWs.readyState === 1) {
                    gcpWs.send(JSON.stringify({
                        tool_response: {
                            function_responses: [{
                                name,
                                response: { error: err.message },
                            }],
                        },
                    }));
                }
            }
        }

        return true; // We handled the function calls
    }
}
