import { Agent } from './agent.js';

const agent = new Agent('You are a helpful AI assistant. Be concise.');

console.log('🤖 Testing Vertex AI Agent connection...');
console.log(`   Project: ${process.env.GOOGLE_CLOUD_PROJECT}`);
console.log(`   Location: ${process.env.GOOGLE_CLOUD_LOCATION}`);
console.log(`   Credentials: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
console.log('');

try {
    const response = await agent.sendMessage('Hello! Who are you and what can you do?');
    console.log('✅ Agent reply:', response);
} catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
}
