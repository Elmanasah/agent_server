// src/modules/logs/log.controller.js

import { LogService } from './log.service.js';
import { catchAsync } from '../../utils/catchAsync.js';

// ── GET /api/v1/logs/me ────────────────────────────────────────────
// Returns the calling user's own activity log (paginated).
export const getMyLogs = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, category } = req.query;
  const result = await LogService.getForUser(req.user.id, {
    page:     Number(page),
    limit:    Math.min(Number(limit), 100),  // cap at 100 per page
    category: category || null,
  });
  res.status(200).json({ status: 'success', ...result });
});

// ── GET /api/v1/logs ───────────────────────────────────────────────
// Admin: returns all activity logs with optional filters.
export const getAllLogs = catchAsync(async (req, res) => {
  const { page = 1, limit = 50, category, userId } = req.query;
  const result = await LogService.getAll({
    page:     Number(page),
    limit:    Math.min(Number(limit), 200),  // cap at 200 per page
    category: category || null,
    userId:   userId   || null,
  });
  res.status(200).json({ status: 'success', ...result });
});
