/**
 * src/middleware/cors.js
 */

import corsLib from 'cors';
import config from '../config/index.js';

const corsMiddleware = corsLib({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
});

export default corsMiddleware;
