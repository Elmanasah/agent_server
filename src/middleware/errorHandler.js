/**
 * src/middleware/errorHandler.js
 *
 * Global Express error handler — must be the LAST middleware registered.
 * Catches anything passed to next(err) or thrown in async route handlers.
 */

import config from '../config/index.js';

// eslint-disable-next-line no-unused-vars
export default function errorHandler(err, req, res, next) {
    let statusCode = err.statusCode || 500;
    let status = err.status || 'error';
    let message = err.message || 'Internal server error';

    // Handle Sequelize specific errors
    if (err.name === 'SequelizeUniqueConstraintError') {
        statusCode = 400;
        status = 'fail';
        message = `Duplicate field value: ${err.errors && err.errors[0] ? err.errors[0].message : 'Value already exists'}.`;
    } else if (err.name === 'SequelizeValidationError') {
        statusCode = 400;
        status = 'fail';
        const errors = Object.values(err.errors).map((el) => el.message);
        message = `Invalid input data. ${errors.join('. ')}`;
    }

    // Handle JWT specific errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        status = 'fail';
        message = 'Invalid token. Please log in again.';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        status = 'fail';
        message = 'Your token has expired! Please log in again.';
    }

    console.error(`[error] ${req.method} ${req.path} → ${statusCode}: ${message}`);
    if (config.isDev && err.stack) console.error(err.stack);

    res.status(statusCode).json({
        status,
        message,
        ...(config.isDev && { stack: err.stack }),
    });
}
