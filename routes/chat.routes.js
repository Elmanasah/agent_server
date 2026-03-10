import express from 'express';
import { sendMessage, resetConversation } from '../controllers/chat.controller.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Basic rate limiting for chat endpoint to prevent abuse
const chatLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes'
});

router.post('/chat', chatLimiter, sendMessage);
router.post('/reset', resetConversation);

export default router;
