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

    async sendMessage(question) {
  const embedding = await createEmbedding(question);
  const docs = searchSimilar(embedding);
  const context = docs.map(d => d.text).join("\n");
  const prompt = `
Use the following context to answer the question.
Context:
${context}
Question:
${question}
`;
  const result = await this.model.generateContent(prompt);
  return result.response.text();
}
}
