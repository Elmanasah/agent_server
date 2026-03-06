import express from 'express';
import cors from 'cors';
import { Agent } from './agent.js';
import config from './config.js';
import morgan from 'morgan';

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
}));

app.use(express.json());
app.use(morgan('dev')); // Standard request logging

// ─── Agent (shared stateful instance) ─────────────────────────────────────────
let agent = new Agent('You are a helpful AI assistant.');

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

// POST /reset → clear conversation history by creating a fresh agent
app.post('/reset', (_req, res) => {
    agent = new Agent('You are a helpful AI assistant.');
    res.json({ status: 'ok', message: 'Conversation reset' });
});

// GET / → health check
app.get('/', (_req, res) => {
    res.json({ status: 'ok', message: 'AI Agent is running 🚀' });
});

app.listen(config.port, () => {
    console.log(`✅ Server running at http://localhost:${config.port}`);
});
