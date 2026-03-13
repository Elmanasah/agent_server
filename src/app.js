/**
 * src/app.js
 *
 * Express application factory.
 * Creates and configures the app — no server.listen() here.
 * This makes the app importable and unit-testable independently.
 */

import express from 'express';
import morgan from 'morgan';

import cors from './middleware/cors.js';
import errorHandler from './middleware/errorHandler.js';

// ── Module routers ────────────────────────────────────────────────────────────
import chatRouter from './modules/chat/chat.routes.js';
import sessionsRouter from './modules/sessions/sessions.routes.js';
import documentsRouter from './modules/documents/documents.routes.js';
import imageRouter from './modules/image/image.routes.js';
import tokenRouter from './modules/token/token.routes.js';

// ── App factory ───────────────────────────────────────────────────────────────
const app = express();

// Global middleware
app.use(cors);
app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/', chatRouter);
app.use('/', sessionsRouter);
app.use('/', documentsRouter);
app.use('/', imageRouter);
app.use('/', tokenRouter);

// Health check
app.get('/', (_req, res) => res.json({ status: 'ok', message: 'AI Agent is running 🚀' }));

// ── Global error handler (must be last) ───────────────────────────────────────
app.use(errorHandler);

export default app;
