// src/middleware/usageGuard.middleware.js
//
// Simple explanation:
//   This middleware sits in front of routes that cost resources.
//   Before the request reaches the controller it checks:
//     1. Is the account locked? → block with 403
//     2. Is the quota exceeded? → block with 429
//     3. Everything OK?        → let the request through
//
// NOTE: For chat requests, usage is checked INSIDE agent.service.js
// This middleware is for other routes like document upload.

import { UsageService } from '../services/usage.service.js';
import AppError from '../utils/AppError.js';

export const usageGuard = (resourceType, quantity = 1) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) return next(new AppError('Unauthorized', 401));

      const result = await UsageService.checkAndIncrement(
        userId,
        resourceType,
        quantity
      );

      // Billing lock — admin manually locked this account
      if (result.is_locked) {
        return next(new AppError(
          `Your account is locked: ${result.lock_reason || 'Please contact support.'}`,
          403,
          { code: 'ACCOUNT_LOCKED', lockReason: result.lock_reason }
        ));
      }

      // Quota exceeded — used too many resources this period
      if (!result.allowed) {
        return next(new AppError(
          `You have reached your ${resourceType} limit. Resets at ${result.reset_at}.`,
          429,
          {
            code:      'USAGE_LIMIT_EXCEEDED',
            resource:  resourceType,
            limit:     result.limit,
            remaining: 0,
            resetAt:   result.reset_at,
            plan:      result.plan,
          }
        ));
      }

      // Attach usage info so controllers can read it
      req.usageResult = result;

      // Send usage info in response headers
      res.set({
        'X-Usage-Limit':     result.limit,
        'X-Usage-Remaining': result.remaining,
        'X-Usage-Reset':     new Date(result.reset_at).toUTCString(),
        'X-Usage-Plan':      result.plan,
      });

      next();
    } catch (err) {
      console.error('[usageGuard] Error:', err.message);
      next(new AppError('Usage check failed', 500));
    }
  };
};