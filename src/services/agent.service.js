/**
 * src/services/agent.service.js
 *
 * Horus Agent — Gemini via Vertex AI with native Function Calling.
 *
 * Tools available to the agent:
 *   - search_knowledge_base  → RAG vector search over user docs
 *   - search_sessions        → keyword search over user's past conversations
 *   - generate_image         → Imagen 3 image generation
 *   - render_canvas          → signals the client to open Canvas with markdown
 *   - render_diagram         → signals the client to render a Mermaid diagram
 *   - render_math            → signals the client to render a math plot
 *
 * In-memory agent cache (sessionId → Agent) lives here.
 * On a cache miss the caller passes the full DB history for context replay.
 */

import { VertexAI } from '@google-cloud/vertexai';
import config from '../config/index.js';
import { buildSystemPrompt } from '../config/systemPrompt.js';
import { retrieveContext } from './rag.service.js';
import { generateImage } from './image.service.js';
import { searchSessions } from './sessionSearch.service.js';

// ── Vertex AI model ───────────────────────────────────────────────────────────

const vertexAI = new VertexAI({
    project: config.projectId,
    location: config.location,
});

export const model = vertexAI.getGenerativeModel({
    model: 'gemini-2.0-flash-001',
});

// ── Tool declarations (Gemini Function Calling) ───────────────────────────────

const TOOL_DECLARATIONS = [
    {
        name: 'search_knowledge_base',
        description:
            'Search the user\'s uploaded documents using semantic similarity. ' +
            'Use this whenever the user asks a question that might be answered by their files.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The search query — a concise phrase capturing what to look for.',
                },
            },
            required: ['query'],
        },
    },
    {
        name: 'search_sessions',
        description:
            'Search the user\'s past conversation history for relevant information. ' +
            'Use this when the user references something they asked about before, or wants to recall previous work.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Keywords or phrase to search in past conversations.',
                },
            },
            required: ['query'],
        },
    },
    {
        name: 'generate_image',
        description:
            'Generate an image from a text prompt using Imagen 3. ' +
            'Use this when the user explicitly asks for an image, illustration, or visual.',
        parameters: {
            type: 'object',
            properties: {
                prompt: {
                    type: 'string',
                    description: 'A detailed, descriptive text prompt for image generation.',
                },
            },
            required: ['prompt'],
        },
    },
    {
        name: 'render_canvas',
        description:
            'Send a rich markdown document to the user\'s Canvas workspace panel. ' +
            'Use this for all detailed explanations, code, step-by-step guides, and long content. ' +
            'Do NOT put long content directly in the chat.',
        parameters: {
            type: 'object',
            properties: {
                markdown: {
                    type: 'string',
                    description: 'Full markdown content to display in the Canvas panel.',
                },
                title: {
                    type: 'string',
                    description: 'A short title for this canvas block (shown in the panel header).',
                },
            },
            required: ['markdown'],
        },
    },
    {
        name: 'render_diagram',
        description:
            'Render a Mermaid diagram in the user\'s Canvas workspace. ' +
            'Use for flowcharts, sequence diagrams, architecture diagrams, and ERDs. ' +
            'MUST start with `graph TD` or `graph LR`. Use `A -->|Label| B` arrow syntax.',
        parameters: {
            type: 'object',
            properties: {
                mermaid_syntax: {
                    type: 'string',
                    description: 'Valid Mermaid syntax. Must start with graph TD or graph LR.',
                },
                title: {
                    type: 'string',
                    description: 'Short label for this diagram.',
                },
            },
            required: ['mermaid_syntax'],
        },
    },
    {
        name: 'render_math',
        description:
            'Render an interactive mathematical plot in the user\'s Canvas workspace. ' +
            'Use for graphs, functions, and data visualization.',
        parameters: {
            type: 'object',
            properties: {
                json: {
                    type: 'string',
                    description:
                        'JSON string with the format: ' +
                        '{"elements":[{"type":"plot-of-x","fn":"Math.sin(x)","color":"blue"}]}',
                },
                title: {
                    type: 'string',
                    description: 'Short label for this plot.',
                },
            },
            required: ['json'],
        },
    },
];

// ── In-memory agent cache ─────────────────────────────────────────────────────

const agentCache = new Map(); // sessionId → Agent

export function getOrCreateAgent(sessionId, history = [], user = null) {
    if (!agentCache.has(sessionId)) {
        agentCache.set(sessionId, new Agent(buildSystemPrompt(user), history, user));
    }
    return agentCache.get(sessionId);
}

export function evictAgent(sessionId) {
    agentCache.delete(sessionId);
}

// ── Agent class ───────────────────────────────────────────────────────────────

export class Agent {
    /**
     * @param {string}   systemInstruction
     * @param {object[]} history  Vertex AI history: [{ role, parts: [{ text }] }]
     * @param {object}   user     Optional user object for tool context
     */
    constructor(systemInstruction, history = [], user = null) {
        this.user = user;
        this.userId = user?.id || null;

        this.chat = model.startChat({
            systemInstruction: {
                role: 'system',
                parts: [{ text: systemInstruction }],
            },
            tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
            history,
        });
    }

    /**
     * Execute a declared tool by name and return its result.
     *
     * @param {string} name   - Tool name
     * @param {object} args   - Tool arguments
     * @returns {Promise<{ text?: string, image?: string, canvas?: object, diagram?: object, math?: object }>}
     */
    async _executeTool(name, args) {
        console.log(`[agent] Executing tool: ${name}`, JSON.stringify(args));

        switch (name) {
            case 'search_knowledge_base': {
                if (!this.userId) return { text: 'No user context available for knowledge base search.' };
                const context = await retrieveContext(this.userId, args.query).catch(err => {
                    console.warn('[agent] RAG error:', err.message);
                    return null;
                });
                return { text: context || 'No relevant documents found in the knowledge base.' };
            }

            case 'search_sessions': {
                if (!this.userId) return { text: 'No user context available for session search.' };
                const sessionContext = await searchSessions(this.userId, args.query).catch(err => {
                    console.warn('[agent] Session search error:', err.message);
                    return null;
                });
                return { text: sessionContext || 'No relevant past conversations found.' };
            }

            case 'generate_image': {
                const imageResult = await generateImage(args.prompt);
                // Return structured so the controller can emit a typed SSE event
                return {
                    text: `Image generated for prompt: "${args.prompt}"`,
                    image: { url: imageResult.imageUrl, prompt: args.prompt },
                };
            }

            case 'render_canvas': {
                return {
                    text: `Canvas content set: "${(args.title || 'Workspace').slice(0, 40)}"`,
                    canvas: { markdown: args.markdown, title: args.title || 'Workspace' },
                };
            }

            case 'render_diagram': {
                return {
                    text: `Diagram rendered: "${(args.title || 'Diagram').slice(0, 40)}"`,
                    diagram: { syntax: args.mermaid_syntax, title: args.title || 'Diagram' },
                };
            }

            case 'render_math': {
                return {
                    text: `Math plot rendered: "${(args.title || 'Plot').slice(0, 40)}"`,
                    math: { json: args.json, title: args.title || 'Math Plot' },
                };
            }

            default:
                console.warn(`[agent] Unknown tool: ${name}`);
                return { text: `Tool "${name}" is not implemented.` };
        }
    }

    /**
     * Send a message to the agent with a full tool-call dispatch loop.
     *
     * @param {string}      message
     * @param {object[]}    attachments   [{ data: base64, mimeType }]
     * @param {string|null} ragContext    Optional pre-fetched RAG context
     * @param {function}    onEvent       Callback for streaming events: (event) => void
     *                                   Events: { type, ...payload }
     * @returns {Promise<{ reply: string, userParts: object[], toolResults: object[] }>}
     */
    async sendMessage(message, attachments = [], ragContext = null, onEvent = null) {
        const emit = (event) => { if (onEvent) onEvent(event); };

        // ── Build initial user parts ───────────────────────────────────────────
        const parts = [];

        if (ragContext) {
            parts.push({ text: `${ragContext}\n\n== USER QUESTION ==\n${message?.trim() ?? ''}` });
        } else if (message?.trim()) {
            parts.push({ text: message });
        }

        for (const att of attachments) {
            if (att.data && att.mimeType) {
                parts.push({ inlineData: { data: att.data, mimeType: att.mimeType } });
            }
        }

        if (parts.length === 0) throw new Error('No content provided');

        const userParts = parts;
        const toolResults = []; // Accumulate tool artifacts for the response

        // ── Agentic loop ───────────────────────────────────────────────────────
        let currentParts = parts;
        let finalReply = '';
        let loopCount = 0;
        const MAX_LOOPS = 8;

        while (loopCount < MAX_LOOPS) {
            loopCount++;

            const result = await this.chat.sendMessage(currentParts);
            const candidate = result.response.candidates?.[0];
            if (!candidate) throw new Error('No candidate returned from model');

            const responseParts = candidate.content.parts || [];

            // Check if this turn has function calls
            const functionCalls = responseParts.filter(p => p.functionCall);
            const textParts = responseParts.filter(p => p.text);

            if (functionCalls.length === 0) {
                // No more tool calls — we have a final text reply
                finalReply = textParts.map(p => p.text).join('');
                if (finalReply) emit({ type: 'token', text: finalReply });
                break;
            }

            // ── Execute all function calls in this turn ────────────────────────
            const functionResponseParts = [];

            for (const part of functionCalls) {
                const { name, args } = part.functionCall;

                emit({ type: 'tool_start', tool: name, args });

                const toolOutput = await this._executeTool(name, args);

                // Surface rich artifacts immediately
                if (toolOutput.image) {
                    emit({ type: 'tool_result', tool: name, result: { image: toolOutput.image } });
                    toolResults.push({ type: 'image', ...toolOutput.image });
                }
                if (toolOutput.canvas) {
                    emit({ type: 'tool_result', tool: name, result: { canvas: toolOutput.canvas } });
                    toolResults.push({ type: 'canvas', ...toolOutput.canvas });
                }
                if (toolOutput.diagram) {
                    emit({ type: 'tool_result', tool: name, result: { diagram: toolOutput.diagram } });
                    toolResults.push({ type: 'diagram', ...toolOutput.diagram });
                }
                if (toolOutput.math) {
                    emit({ type: 'tool_result', tool: name, result: { math: toolOutput.math } });
                    toolResults.push({ type: 'math', ...toolOutput.math });
                }

                functionResponseParts.push({
                    functionResponse: {
                        name,
                        response: { output: toolOutput.text || 'Done' },
                    },
                });
            }

            // Also emit any text from this intermediate turn
            if (textParts.length) {
                const intermediateText = textParts.map(p => p.text).join('');
                if (intermediateText.trim()) emit({ type: 'token', text: intermediateText });
            }

            // Send tool results back into the loop
            currentParts = functionResponseParts;
        }

        if (loopCount >= MAX_LOOPS) {
            console.warn('[agent] Max tool loop iterations reached');
        }

        return { reply: finalReply, userParts, toolResults };
    }
}
