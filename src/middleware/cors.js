/**
 * src/middleware/cors.js
 */

import corsLib from 'cors';
import config from '../config/index.js';

const corsMiddleware = corsLib({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
});

export default corsMiddleware;
