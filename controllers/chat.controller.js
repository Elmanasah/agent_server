import { Agent } from '../agent.js';
import AppError from '../utils/AppError.js';

// Shared stateful instance
let agent = new Agent('You are a helpful AI assistant.');

export const sendMessage = async (req, res, next) => {
    const { message } = req.body;
    if (!message) {
        return next(new AppError('message field is required', 400));
    }
    try {
        const reply = await agent.sendMessage(message);
        res.json({ reply });
    } catch (err) {
        console.error(err.message);
        next(new AppError('Failed to get a response from the AI agent', 500));
    }
};

export const resetConversation = (req, res) => {
    agent = new Agent('You are a helpful AI assistant.');
    res.json({ status: 'ok', message: 'Conversation reset' });
};
