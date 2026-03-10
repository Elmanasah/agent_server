import { model } from './vertex.js';

export class Agent {
    constructor(systemInstruction = 'You are a helpful AI assistant.') {
        const multimodalInstructions = `
            You have access to a right-side "AI Workspace" Canvas. 
            - To write complex text, math solutions, or code to the Canvas, wrap it in: \`\`\`canvas [content] \`\`\`
            - To generate an image within the Canvas, use: \`\`\`image: [prompt] \`\`\`
            - You can use both in one response. Example: "Here is the math solution: \`\`\`canvas [math] \`\`\` and here is a visualization: \`\`\`image: [geometric shape] \`\`\`"
            - Keep the main chat for brief communication and the Canvas for detailed work.
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
