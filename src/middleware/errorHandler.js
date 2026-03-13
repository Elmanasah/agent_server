/**
 * src/middleware/errorHandler.js
 *
 * Global Express error handler — must be the LAST middleware registered.
 * Catches anything passed to next(err) or thrown in async route handlers.
 */

import config from '../config/index.js';

// eslint-disable-next-line no-unused-vars
export default function errorHandler(err, req, res, next) {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal server error';

    console.error(`[error] ${req.method} ${req.path} → ${status}: ${message}`);
    if (config.isDev && err.stack) console.error(err.stack);

    res.status(status).json({
        error: message,
        ...(config.isDev && { stack: err.stack }),
    });
}
