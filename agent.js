import { model } from './vertex.js';

export class Agent {
    constructor(systemInstruction = 'You are a helpful AI assistant.') {
        const multimodalInstructions = `
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
               - NEVER USE \`-- Label -->\! (This is INVALID and will BREAK the UI).
               - DO NOT USE SEMICOLONS (\`;\`) AT THE END OF LINES.
               - WRAP ALL DIAGRAMS IN TRIPLE BACKTICKS.
               Example:
               \`\`\`mermaid
               graph TD
                 A[Step 1] -->|Next| B[Step 2]
                 B --> C[Step 3]
               \`\`\`
               NEVER write mermaid syntax as plain text without backticks.
            4. **Order Matters**: Put explanations in \`\`\`canvas\`\`\` first, then visualizations (\`\`\`math\`\`\` or \`\`\`mermaid\`\`\`).
            5. **Image Block (\`\`\`image: [prompt] \`\`\`):** Use for autonomous image generation.
            
            **Example Response:**
            "I've mapped out the process for you.
            \`\`\`canvas
            ### Project Workflow
            This diagram shows the logic flow...
            \`\`\`
            \`\`\`mermaid
            graph TD;
                A-->B;
                B-->C;
            \`\`\`"
            
            Keep chat messages brief and friendly. Put all "work" in the Workspace.
        `;
        this.chat = model.startChat({
            systemInstruction: {
                role: 'system',
                parts: [{ text: systemInstruction + multimodalInstructions }],
            },
        });
    }

    async sendMessage(message, attachments = []) {
        try {
            const parts = [];

            // Only add text part if there is a message
            if (message && message.trim()) {
                parts.push({ text: message });
            }

            // Add attachments to parts
            for (const att of attachments) {
                if (att.data && att.mimeType) {
                    parts.push({
                        inlineData: {
                            data: att.data, // Base64 string
                            mimeType: att.mimeType
                        }
                    });
                }
            }

            if (parts.length === 0) {
                throw new Error('No content provided (message or attachments)');
            }

            // In Vertex AI SDK, sendMessage takes string | Part | (string | Part)[]
            const result = await this.chat.sendMessage(parts);
            const candidate = result.response.candidates?.[0];
            if (!candidate) throw new Error('No candidate returned from model');
            return candidate.content.parts[0].text;
        } catch (error) {
            console.error('Error sending message:', error.message);
            throw error;
        }
    }
}
