// src/utils/AppError.js
//
// Simple explanation:
//   This is our custom error class.
//   Whenever something goes wrong in the app we throw this
//   instead of a plain Error — it carries extra info like
//   the HTTP status code and structured details.
//
// Example:
//   throw new AppError('Not found', 404)
//   throw new AppError('Limit exceeded', 429, { code: 'USAGE_LIMIT_EXCEEDED', remaining: 0 })

class AppError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    // Optional structured details — sent in the response body
    // Useful for quota errors (remaining, resetAt, plan etc.)
    if (details) this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;