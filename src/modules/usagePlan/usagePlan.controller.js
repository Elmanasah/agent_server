// src/modules/usagePlan/usagePlan.controller.js

import { UsagePlanService } from './usagePlan.service.js';
import { catchAsync } from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';

const VALID_RESET_PERIODS = ['daily', 'monthly'];

// ── GET /api/v1/plans ──────────────────────────────────────────────
export const getAllPlans = catchAsync(async (_req, res) => {
  const plans = await UsagePlanService.getAllPlans();
  res.status(200).json({ status: 'success', results: plans.length, data: plans });
});

// ── GET /api/v1/plans/:name ────────────────────────────────────────
export const getPlanByName = catchAsync(async (req, res) => {
  const plan = await UsagePlanService.getPlanByName(req.params.name);
  res.status(200).json({ status: 'success', data: plan });
});

// ── POST /api/v1/plans ─────────────────────────────────────────────
export const createPlan = catchAsync(async (req, res, next) => {
  const { planName, imageLimit, videoLimit, apiCallLimit, documentLimit, resetPeriod } = req.body;

  if (!planName) return next(new AppError('planName is required', 400));
  if (!resetPeriod || !VALID_RESET_PERIODS.includes(resetPeriod)) {
    return next(new AppError(`resetPeriod must be one of: ${VALID_RESET_PERIODS.join(', ')}`, 400));
  }

  const plan = await UsagePlanService.createPlan({
    planName,
    imageLimit:    imageLimit    ?? 10,
    videoLimit:    videoLimit    ?? 5,
    apiCallLimit:  apiCallLimit  ?? 100,
    documentLimit: documentLimit ?? 20,
    resetPeriod,
  });

  res.status(201).json({ status: 'success', data: plan });
});

// ── PATCH /api/v1/plans/:name ──────────────────────────────────────
export const updatePlan = catchAsync(async (req, res, next) => {
  const { resetPeriod } = req.body;

  if (resetPeriod && !VALID_RESET_PERIODS.includes(resetPeriod)) {
    return next(new AppError(`resetPeriod must be one of: ${VALID_RESET_PERIODS.join(', ')}`, 400));
  }

  const plan = await UsagePlanService.updatePlan(req.params.name, req.body);
  res.status(200).json({ status: 'success', data: plan });
});

// ── DELETE /api/v1/plans/:name ─────────────────────────────────────
export const deletePlan = catchAsync(async (req, res) => {
  await UsagePlanService.deletePlan(req.params.name);
  res.status(204).send();
});
