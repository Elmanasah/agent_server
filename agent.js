import { model } from './vertex.js';

export class Agent {
    constructor(systemInstruction = 'You are a helpful AI assistant.') {
        this.chat = model.startChat({
            systemInstruction: {
                role: 'system',
                parts: [{ text: systemInstruction }],
            },
        });
    }

    async sendMessage(message) {
        try {
            const result = await this.chat.sendMessage(message);
            const candidate = result.response.candidates?.[0];
            if (!candidate) throw new Error('No candidate returned from model');
            return candidate.content.parts[0].text;
        } catch (error) {
            console.error('Error sending message:', error.message);
            throw error;
        }
    }
}
