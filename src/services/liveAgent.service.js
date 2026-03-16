/**
 * src/services/liveAgent.service.js
 *
 * Manages per-connection state for the Live Audio Agent (WebSocket).
 *
 * Each browser WebSocket connection gets a LiveAgentSession that:
 *  1. Authenticates the user via JWT
 *  2. Detects BidiGenerateContentToolCall messages from GCP
 *  3. Executes tools server-side (RAG, image gen, DB search, canvas, diagrams)
 *  4. Sends BidiGenerateContentToolResponse back to GCP
 *  5. Sends rich tool_result payloads to the browser for Canvas rendering
 *  6. Forwards final audio/text to the browser client
 *
 * IMPORTANT: BidiGenerateContent uses a dedicated message format for function
 * calling (separate from serverContent). Tool calls arrive as:
 *   { toolCall: { functionCalls: [{ name, args, id }] } }
 * And responses must be sent as:
 *   { toolResponse: { functionResponses: [{ name, response, id }] } }
 */

import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { buildSystemPrompt } from '../config/systemPrompt.js';
import { retrieveContext } from './rag.service.js';
import { generateImage } from './image.service.js';
import { searchSessions } from './sessionSearch.service.js';
import { User } from '../models/index.js';

// ── Tool executor (returns structured results like agent.service.js) ──────────

async function executeTool(name, args, userId) {
    console.log(`[liveAgent] tool: ${name}`, args);

    switch (name) {
        case 'search_knowledge_base': {
            if (!userId) return { text: 'No user context for knowledge base search.' };
            const context = await retrieveContext(userId, args.query).catch(() => null);
            return { text: context || 'No relevant documents found.' };
        }
        case 'search_sessions': {
            if (!userId) return { text: 'No user context for session search.' };
            const result = await searchSessions(userId, args.query).catch(() => null);
            return { text: result || 'No relevant past conversations found.' };
        }
        case 'generate_image': {
            const img = await generateImage(args.prompt);
            return {
                text: `Image generated for: "${args.prompt}"`,
                image: { url: img.imageUrl, prompt: args.prompt },
            };
        }
        case 'render_canvas':
            return {
                text: `Canvas content set: "${(args.title || 'Workspace').slice(0, 40)}"`,
                canvas: { markdown: args.markdown, title: args.title || 'Workspace' },
            };
        case 'render_diagram':
            return {
                text: `Diagram rendered: "${(args.title || 'Diagram').slice(0, 40)}"`,
                diagram: { syntax: args.mermaid_syntax, title: args.title || 'Diagram' },
            };
        case 'render_math':
            return {
                text: `Math plot rendered: "${(args.title || 'Plot').slice(0, 40)}"`,
                math: { json: args.json, title: args.title || 'Math Plot' },
            };
        default:
            return { text: `Tool "${name}" not implemented in live agent.` };
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
     * @returns {Promise<{ userId: string, serviceUrl: string, systemInstruction: string }>}
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
     *
     * BidiGenerateContent uses TWO formats for function calls:
     *   1. Dedicated: { toolCall: { functionCalls: [{ name, args, id }] } }
     *   2. Legacy/inline: { serverContent: { modelTurn: { parts: [{ functionCall }] } } }
     *
     * We handle both formats. Responses must use the matching format.
     *
     * @param {string} rawData - Raw JSON string from GCP WebSocket
     * @param {WebSocket} gcpWs - GCP WebSocket to send tool responses back to
     * @returns {boolean} - true if we handled it (tool call), false if caller should forward as-is
     */
    async handleGcpMessage(rawData, gcpWs) {
        let data;
        try { data = JSON.parse(rawData); } catch { return false; }

        // ── Format 1: BidiGenerateContentToolCall (dedicated message) ─────
        // This is the primary format used by BidiGenerateContent for function calling
        const toolCallMsg = data?.toolCall;
        if (toolCallMsg?.functionCalls?.length > 0) {
            console.log(`[liveAgent] Got BidiGenerateContentToolCall with ${toolCallMsg.functionCalls.length} call(s)`);

            const functionResponses = [];

            for (const fc of toolCallMsg.functionCalls) {
                const { name, args, id } = fc;

                try {
                    const output = await executeTool(name, args, this.userId);

                    // Build function response for GCP
                    const gcpText = typeof output === 'object' ? (output.text || 'Done') : String(output);
                    functionResponses.push({
                        name,
                        id,
                        response: { output: gcpText },
                    });

                    // Send rich tool_result to browser client for Canvas/UI updates
                    if (this.clientWs.readyState === 1) {
                        const clientPayload = { tool_result: { name } };
                        if (typeof output === 'object') {
                            if (output.canvas) clientPayload.tool_result.canvas = output.canvas;
                            if (output.diagram) clientPayload.tool_result.diagram = output.diagram;
                            if (output.math) clientPayload.tool_result.math = output.math;
                            if (output.image) clientPayload.tool_result.image = output.image;
                        }
                        this.clientWs.send(JSON.stringify(clientPayload));
                    }

                } catch (err) {
                    console.error(`[liveAgent] Tool error (${name}):`, err.message);
                    functionResponses.push({
                        name,
                        id,
                        response: { error: err.message },
                    });
                }
            }

            // Send BidiGenerateContentToolResponse back to GCP
            if (gcpWs && gcpWs.readyState === 1) {
                gcpWs.send(JSON.stringify({
                    tool_response: {
                        function_responses: functionResponses,
                    },
                }));
            }

            return true;
        }

        // ── Format 2: Inline functionCall parts in serverContent (fallback) ──
        const parts = data?.serverContent?.modelTurn?.parts ?? [];
        const functionCalls = parts.filter(p => p.functionCall);

        if (functionCalls.length === 0) return false; // Nothing special — let proxy forward

        console.log(`[liveAgent] Got ${functionCalls.length} inline function call(s)`);

        for (const part of functionCalls) {
            const { name, args } = part.functionCall;

            try {
                const output = await executeTool(name, args, this.userId);
                const gcpText = typeof output === 'object' ? (output.text || 'Done') : String(output);

                // Send tool_response back to GCP (inline format)
                if (gcpWs && gcpWs.readyState === 1) {
                    gcpWs.send(JSON.stringify({
                        tool_response: {
                            function_responses: [{
                                name,
                                response: { output: gcpText },
                            }],
                        },
                    }));
                }

                // Forward rich tool_result to browser client
                if (this.clientWs.readyState === 1) {
                    const clientPayload = { tool_result: { name } };
                    if (typeof output === 'object') {
                        if (output.canvas) clientPayload.tool_result.canvas = output.canvas;
                        if (output.diagram) clientPayload.tool_result.diagram = output.diagram;
                        if (output.math) clientPayload.tool_result.math = output.math;
                        if (output.image) clientPayload.tool_result.image = output.image;
                    }
                    this.clientWs.send(JSON.stringify(clientPayload));
                }

            } catch (err) {
                console.error(`[liveAgent] Tool error (${name}):`, err.message);
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

        return true;
    }
}
