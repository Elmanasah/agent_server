import { model } from './vertex.js';

const MULTIMODAL_INSTRUCTIONS = `
    You have access to a right-side "AI Workspace" Canvas. 
    **AI Workspace Rules:**
    You have a persistent "AI Workspace" Canvas on the right. 
    1. **Canvas Block (\`\`\`canvas [text/markdown] \`\`\`):** Use this for ALL detailed explanations, math solutions, step-by-step guides, and code. DO NOT put long content in the chat.
    2. **Math Block (\`\`\`math [JSON] \`\`\`):** Use this ONLY for interactive graphs. The content MUST be valid JSON.
       JSON format: { "elements": [{ "type": "plot-of-x", "fn": "Math.sin(x)", "color": "blue" }, { "type": "point", "x": 1, "y": 1 }, { "type": "vector", "tipX": 5, "tipY": 2 }, { "type": "text", "x": 0, "y": 0, "text": "Label" }] }
       Types available: \`plot-of-x\` (fn: string), \`point\` (x, y), \`vector\` (tipX, tipY), \`circle\` (centerX, centerY, radius), \`text\` (x, y, text).
    3. **Diagram Block (\`\`\`mermaid [syntax] \`\`\`):** Use this for flowcharts, sequence diagrams, and architecture maps. 
       CRITICAL RULES FOR DIAGRAMS:
       - YOU MUST START WITH \`graph TD\` OR \`graph LR\`.
       - FOR LABELS ON ARROWS, YOU MUST USE: \`A -->|Label| B\`.
       - NEVER USE \`-- Label -->\`! (This is INVALID and will BREAK the UI).
       - DO NOT USE SEMICOLONS (\`;\`) AT THE END OF LINES.
       - WRAP ALL DIAGRAMS IN TRIPLE BACKTICKS.
    4. **Order Matters**: Put explanations in \`\`\`canvas\`\`\` first, then visualizations.
    5. **Image Block (\`\`\`image: [prompt] \`\`\`):** Use for autonomous image generation.
    Keep chat messages brief and friendly. Put all "work" in the Workspace.
`;

export class Agent {
    /**
     * @param {string}   systemInstruction
     * @param {object[]} history  - Vertex AI history array from a saved session.
     *                             Pass [] for a new conversation.
     *                             Format: [{ role: 'user'|'model', parts: [{ text }] }]
     */
    constructor(systemInstruction = 'You are a helpful AI assistant.', history = []) {
        this.chat = model.startChat({
            systemInstruction: {
                role:  'system',
                parts: [{ text: systemInstruction + MULTIMODAL_INSTRUCTIONS }],
            },
            // Restores the full prior conversation into Gemini's context window.
            // This is what makes the agent remember past exchanges.
            history,
        });
    }

    /**
     * @param {string}      message
     * @param {object[]}    attachments  - [{ data: base64, mimeType }]
     * @param {string|null} ragContext
     * @returns {Promise<{ reply: string, userParts: object[] }>}
     */
    async sendMessage(message, attachments = [], ragContext = null) {
        try {
            const parts = [];

            if (ragContext) {
                parts.push({
                    text: `${ragContext}\n\n== USER QUESTION ==\n${message?.trim() ?? ''}`,
                });
            } else if (message?.trim()) {
                parts.push({ text: message });
            }

            for (const att of attachments) {
                if (att.data && att.mimeType) {
                    parts.push({ inlineData: { data: att.data, mimeType: att.mimeType } });
                }
            }

            if (parts.length === 0) throw new Error('No content provided');

            const result    = await this.chat.sendMessage(parts);
            const candidate = result.response.candidates?.[0];
            if (!candidate) throw new Error('No candidate returned from model');

            const reply = candidate.content.parts[0].text;
            // Return userParts too so the caller can persist both turns
            return { reply, userParts: parts };

        } catch (error) {
            console.error('Error sending message:', error.message);
            throw error;
        }
    }
}
