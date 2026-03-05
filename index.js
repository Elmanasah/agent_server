import express from 'express';
import { Agent } from './agent.js';
import config from './config.js';

const app = express();
app.use(express.json());

// One shared agent instance per server (stateful conversation)
const agent = new Agent('You are a helpful AI assistant.');

// POST /chat → send a message to the agent
app.post('/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'message field is required' });
    }
    try {
        const reply = await agent.sendMessage(message);
        res.json({ reply });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to get a response from the AI agent' });
    }
});

// GET / → health check
app.get('/', (_req, res) => {
    res.json({ status: 'ok', message: 'AI Agent is running 🚀' });
});

app.listen(config.port, () => {
    console.log(`✅ Server running at http://localhost:${config.port}`);
});
