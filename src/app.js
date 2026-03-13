/**
 * src/app.js
 *
 * Express application factory.
 * Creates and configures the app — no server.listen() here.
 * This makes the app importable and unit-testable independently.
 */

import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import passport from 'passport';

import cors from './middleware/cors.js';
import errorHandler from './middleware/errorHandler.js';

// ── Module routers ────────────────────────────────────────────────────────────
import chatRouter from './modules/chat/chat.routes.js';
import sessionsRouter from './modules/sessions/sessions.routes.js';
import documentsRouter from './modules/documents/documents.routes.js';
import imageRouter from './modules/image/image.routes.js';
import tokenRouter from './modules/token/token.routes.js';
import authRouter from './modules/auth/auth.routes.js';
import userRouter from './modules/users/user.routes.js';
import verifyToken from './middleware/verifyToken.js';

// ── App factory ───────────────────────────────────────────────────────────────
const app = express();

// Global middleware
app.use(cors);
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use(passport.initialize());

// ── Routes (all versioned under /api/v1) ──────────────────────────────────────
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/chat', verifyToken, chatRouter);
app.use('/api/v1/sessions', verifyToken, sessionsRouter);
app.use('/api/v1/documents', verifyToken, documentsRouter);
app.use('/api/v1/image', verifyToken, imageRouter);
app.use('/api/v1/token', verifyToken, tokenRouter);

// Health check
app.get('/', (_req, res) => res.json({ status: 'ok', message: 'AI Agent is running 🚀' }));

// ── Global error handler (must be last) ───────────────────────────────────────
app.use(errorHandler);

export default app;
