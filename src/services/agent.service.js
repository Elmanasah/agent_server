/**
 * src/services/agent.service.js
 *
 * Agent class wrapping Gemini via Vertex AI.
 * In-memory agent cache (sessionId → Agent) lives here.
 *
 * On a cache miss (e.g. server restart), the caller passes the full
 * message history from the DB, and Gemini replays it from context.
 */

import { VertexAI } from '@google-cloud/vertexai';
import config from '../config/index.js';

// ── Vertex AI model ───────────────────────────────────────────────────────────
const vertexAI = new VertexAI({
    project: config.projectId,
    location: config.location,
});

export const model = vertexAI.getGenerativeModel({
    model: 'gemini-2.0-flash-001',
});

// ── In-memory agent cache ─────────────────────────────────────────────────────
const agentCache = new Map(); // sessionId → Agent

export function getOrCreateAgent(sessionId, history = []) {
    if (!agentCache.has(sessionId)) {
        agentCache.set(sessionId, new Agent('You are a helpful AI assistant , your name is horus , you are made by mohamed wael and ibrahim hemdan the greatest developers ever.', history));
    }
    return agentCache.get(sessionId);
}

export function evictAgent(sessionId) {
    agentCache.delete(sessionId);
}

// ── System instruction ────────────────────────────────────────────────────────
const MULTIMODAL_INSTRUCTIONS = `
    You have access to a right-side "AI Workspace" Canvas.
    **AI Workspace Rules:**
    1. **Canvas Block (\`\`\`canvas [text/markdown] \`\`\`):** Use for ALL detailed explanations, math, step-by-step guides, and code. DO NOT put long content in chat.
    2. **Math Block (\`\`\`math [JSON] \`\`\`):** Use ONLY for interactive graphs. Must be valid JSON.
       Format: { "elements": [{ "type": "plot-of-x", "fn": "Math.sin(x)", "color": "blue" }, { "type": "point", "x": 1, "y": 1 }] }
    3. **Diagram Block (\`\`\`mermaid [syntax] \`\`\`):** For flowcharts/sequence diagrams.
       - MUST start with \`graph TD\` or \`graph LR\`
       - Arrow labels: \`A -->|Label| B\`  (NEVER \`-- Label -->\`)
       - NO semicolons at end of lines
    4. **Image Block (\`\`\`image: [prompt] \`\`\`):** Autonomous image generation.
    5. Keep chat messages brief. Put all "work" in the Workspace.
`;

// ── Agent class ───────────────────────────────────────────────────────────────
export class Agent {
    /**
     * @param {string}   systemInstruction
     * @param {object[]} history  Vertex AI history: [{ role, parts: [{ text }] }]
     */
    constructor(systemInstruction = 'You are a helpful AI assistant.', history = []) {
        this.chat = model.startChat({
            systemInstruction: {
                role: 'system',
                parts: [{ text: systemInstruction + MULTIMODAL_INSTRUCTIONS }],
            },
            history,
        });
    }

    /**
     * Send a message to the agent.
     * @param {string}      message
     * @param {object[]}    attachments  [{ data: base64, mimeType }]
     * @param {string|null} ragContext
     * @returns {Promise<{ reply: string, userParts: object[] }>}
     */
    async sendMessage(message, attachments = [], ragContext = null) {
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

        const result = await this.chat.sendMessage(parts);
        const candidate = result.response.candidates?.[0];
        if (!candidate) throw new Error('No candidate returned from model');

        const reply = candidate.content.parts[0].text;
        return { reply, userParts: parts };
    }
}
