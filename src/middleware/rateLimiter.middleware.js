import rateLimit from 'express-rate-limit';

// Global Rate Limiting
export const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 5 minutes
  max: 100, // limit each IP to 75 requests per windowMs
  message: {
    status: 'fail',
    message: 'Too many requests from this IP, please try again after 5 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for Auth
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 attempts
  message: {
    status: 'fail',
    message: 'Too many login attempts, please try again after an hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
