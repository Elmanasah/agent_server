// src/modules/usagePlan/usagePlan.service.js
//
// Admin-controlled CRUD for usage plans.
// The model lives in ../usage/usagePlan.model.js (shared).

import UsagePlan from '../usage/usagePlan.model.js';
import UserUsage from '../usage/userUsage.model.js';
import AppError  from '../../utils/AppError.js';

export class UsagePlanService {

  // ── List all plans ──────────────────────────────────────────────
  static async getAllPlans() {
    return UsagePlan.findAll({ order: [['planName', 'ASC']] });
  }

  // ── Get single plan by name ─────────────────────────────────────
  static async getPlanByName(planName) {
    const plan = await UsagePlan.findOne({ where: { planName } });
    if (!plan) throw new AppError(`Plan '${planName}' not found.`, 404);
    return plan;
  }

  // ── Create a new plan ───────────────────────────────────────────
  static async createPlan({ planName, imageLimit, videoLimit, apiCallLimit, documentLimit, resetPeriod }) {
    const existing = await UsagePlan.findOne({ where: { planName } });
    if (existing) throw new AppError(`Plan '${planName}' already exists.`, 409);

    return UsagePlan.create({ planName, imageLimit, videoLimit, apiCallLimit, documentLimit, resetPeriod });
  }

  // ── Update plan limits / reset period ──────────────────────────
  static async updatePlan(planName, updates) {
    const plan = await UsagePlan.findOne({ where: { planName } });
    if (!plan) throw new AppError(`Plan '${planName}' not found.`, 404);

    // Only allow updating numeric limits and resetPeriod
    const allowed = ['imageLimit', 'videoLimit', 'apiCallLimit', 'documentLimit', 'resetPeriod'];
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    );

    await plan.update(filtered);
    return plan.reload();
  }

  // ── Delete a plan ───────────────────────────────────────────────
  // Guard: cannot delete a plan that has active users on it.
  static async deletePlan(planName) {
    const plan = await UsagePlan.findOne({ where: { planName } });
    if (!plan) throw new AppError(`Plan '${planName}' not found.`, 404);

    const usersOnPlan = await UserUsage.count({ where: { planName } });
    if (usersOnPlan > 0) {
      throw new AppError(
        `Cannot delete plan '${planName}' — ${usersOnPlan} user(s) are still on it. Move them to another plan first.`,
        409
      );
    }

    await plan.destroy();
  }
}
