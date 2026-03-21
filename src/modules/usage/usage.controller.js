// src/modules/usage/usage.controller.js

import { UsageService } from '../../services/usage.service.js';
import AppError from '../../utils/AppError.js';
import { catchAsync } from '../../utils/catchAsync.js';

// ── Your own usage ─────────────────────────────────────────────
export const getMyUsage = catchAsync(async (req, res) => {
  const summary = await UsageService.getUserUsageSummary(req.user.id);
  res.status(200).json({ status: 'success', data: summary });
});

// ── Admin: view any user ───────────────────────────────────────
export const getUserUsage = catchAsync(async (req, res) => {
  const summary = await UsageService.getUserUsageSummary(req.params.userId);
  res.status(200).json({ status: 'success', data: summary });
});

// ── Admin: change plan ─────────────────────────────────────────
export const updateUserPlan = catchAsync(async (req, res, next) => {
  const { plan } = req.body;
  if (!plan) return next(new AppError('plan is required', 400));
  const newPlan = await UsageService.setUserPlan(req.params.userId, plan);
  res.status(200).json({ status: 'success', data: { plan: newPlan } });
});

// ── Admin: reset counters ──────────────────────────────────────
export const resetUserUsage = catchAsync(async (req, res) => {
  await UsageService.resetUserUsage(req.params.userId);
  res.status(200).json({ status: 'success', message: 'Usage counters reset.' });
});

// ── Admin: billing lock ────────────────────────────────────────
export const lockUserAccount = catchAsync(async (req, res) => {
  const { reason } = req.body;
  await UsageService.lockUser(req.params.userId, reason);
  res.status(200).json({
    status: 'success',
    message: `User ${req.params.userId} has been locked.`,
  });
});

// ── Admin: remove billing lock ─────────────────────────────────
export const unlockUserAccount = catchAsync(async (req, res) => {
  await UsageService.unlockUser(req.params.userId);
  res.status(200).json({
    status: 'success',
    message: `User ${req.params.userId} has been unlocked.`,
  });
});

// ── Admin: trigger scheduled reset manually ────────────────────
export const runScheduledReset = catchAsync(async (req, res) => {
  const count = await UsageService.runScheduledReset();
  res.status(200).json({ status: 'success', data: { usersReset: count } });
});