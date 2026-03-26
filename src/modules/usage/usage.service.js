import sequelize from '../../db/index.js';
import { Op } from 'sequelize';
import UserUsage from './userUsage.model.js';
import UsagePlan from './usagePlan.model.js';
import AppError from '../../utils/AppError.js';

export const RESOURCE_TYPES = {
  IMAGE:    'image',
  VIDEO:    'video',
  API_CALL: 'api_call',
  DOCUMENT: 'document',
};

const RESOURCE_COLUMNS = {
  image:    { used: 'imagesUsed',    limit: 'imageLimit' },
  video:    { used: 'videosUsed',    limit: 'videoLimit' },
  api_call: { used: 'apiCallsUsed',  limit: 'apiCallLimit' },
  document: { used: 'documentsUsed', limit: 'documentLimit' },
};

export class UsageService {


  static async checkAndIncrement(userId, resource, quantity = 1) {
    const cols = RESOURCE_COLUMNS[resource];
    if (!cols) throw new Error(`Unknown resource type: ${resource}`);

    return await sequelize.transaction(async (t) => {
      // ── Step 1: Lock ONLY the user_usage row (no JOIN) ──────────
      // CockroachDB does not allow FOR UPDATE on the nullable side of
      // a LEFT OUTER JOIN. We lock just the usage row, then fetch the
      // plan in a separate query.
      let usageRow = await UserUsage.findOne({
        where: { userId },
        lock:  t.LOCK.UPDATE,
        transaction: t,
      });

      if (!usageRow) {
        // Safe create (CockroachDB doesn't support Sequelize findOrCreate)
        try {
          await UserUsage.create({ userId, planName: 'free' }, { transaction: t });
        } catch (err) {
          if (err.name !== 'SequelizeUniqueConstraintError') throw err;
        }
        usageRow = await UserUsage.findOne({
          where: { userId },
          lock:  t.LOCK.UPDATE,
          transaction: t,
        });
      }

      // ── Step 2: Fetch plan (no lock needed — plans are read-only) ─
      const plan = await UsagePlan.findOne({
        where: { planName: usageRow.planName },
        transaction: t,
      });

      if (!plan) {
        throw new AppError(`Plan '${usageRow.planName}' not found. Cannot determine limits.`, 500);
      }

      // 💥 COCKROACH DB FIX: BigInts/Ints are returned as STRINGS by the PG driver to prevent precision loss.
      // E.g '1' + 1 = '11', which evaluates String('11') > String('100') as TRUE!
      // Must cast to Number.
      const currentUsed = Number(usageRow[cols.used]) || 0;
      const planLimit   = Number(plan[cols.limit]) || 0;
      const resetAt     = plan.resetPeriod === 'daily'
        ? new Date(new Date(usageRow.periodStart).getTime() + 86400000)
        : new Date(new Date(usageRow.periodStart).setMonth(new Date(usageRow.periodStart).getMonth() + 1));

      if (usageRow.isLocked) {
        return { allowed: false, is_locked: true, lock_reason: usageRow.lockReason, current: currentUsed, limit: 0, remaining: 0, plan: usageRow.planName, reset_at: resetAt };
      }

      if (currentUsed + quantity > planLimit) {
        return { allowed: false, is_locked: false, current: currentUsed, limit: planLimit, remaining: Math.max(planLimit - currentUsed, 0), plan: usageRow.planName, reset_at: resetAt };
      }

      await usageRow.increment(cols.used, { by: quantity, transaction: t });

      return { allowed: true, is_locked: false, current: currentUsed + quantity, limit: planLimit, remaining: planLimit - (currentUsed + quantity), plan: usageRow.planName, reset_at: resetAt };
    });
  }

  static async getUserUsageSummary(userId) {
    let row = await UserUsage.findOne({
      where: { userId },
      include: [{ model: UsagePlan, as: 'plan', foreignKey: 'planName', targetKey: 'planName' }],
    });

    if (!row) {
      try {
        await UserUsage.create({ userId, planName: 'free' });
      } catch (err) {
        if (err.name !== 'SequelizeUniqueConstraintError') throw err;
      }
      row = await UserUsage.findOne({
        where: { userId },
        include: [{ model: UsagePlan, as: 'plan', foreignKey: 'planName', targetKey: 'planName' }],
      });
      if (!row) throw new AppError('Failed to initialize usage row', 500);
    }

    const plan = row.plan;
    if (!plan) {
      throw new AppError(`Assigned plan '${row.planName}' does not exist.`, 500);
    }
    const resetAt = plan.resetPeriod === 'daily'
      ? new Date(new Date(row.periodStart).getTime() + 86400000)
      : new Date(new Date(row.periodStart).setMonth(new Date(row.periodStart).getMonth() + 1));

    return {
      plan:        row.planName,
      isLocked:    row.isLocked,
      lockReason:  row.lockReason,
      resetPeriod: plan.resetPeriod,
      nextResetAt: resetAt,
      lastResetAt: row.lastResetAt,
      periodStart: row.periodStart,
      resources: {
        images:    { used: row.imagesUsed,    limit: plan.imageLimit,    remaining: plan.imageLimit    - row.imagesUsed },
        videos:    { used: row.videosUsed,    limit: plan.videoLimit,    remaining: plan.videoLimit    - row.videosUsed },
        apiCalls:  { used: row.apiCallsUsed,  limit: plan.apiCallLimit,  remaining: plan.apiCallLimit  - row.apiCallsUsed },
        documents: { used: row.documentsUsed, limit: plan.documentLimit, remaining: plan.documentLimit - row.documentsUsed },
      },
    };
  }

  static async setUserPlan(userId, planName) {
    // Verify the plan actually exists before updating
    const plan = await UsagePlan.findOne({ where: { planName } });
    if (!plan) throw new AppError(`Plan '${planName}' does not exist.`, 400);

    const [updated] = await UserUsage.update({ planName }, { where: { userId } });
    if (!updated) throw new AppError(`No usage row found for user ${userId}`, 404);
    
    return planName;
  }

  static async lockUser(userId, reason = 'Account locked by admin') {
    await UserUsage.update({ isLocked: true, lockReason: reason }, { where: { userId } });
  }

  static async unlockUser(userId) {
    await UserUsage.update({ isLocked: false, lockReason: null }, { where: { userId } });
  }

  static async resetUserUsage(userId) {
    await UserUsage.update({
      imagesUsed: 0, videosUsed: 0, apiCallsUsed: 0, documentsUsed: 0,
      periodStart: new Date(), lastResetAt: new Date(),
    }, { where: { userId } });
  }

  static async runScheduledReset() {
    const now = new Date();

    // ── daily plans: periodStart older than 24 h ──────────────────────────────
    const dailyExpiry  = new Date(now.getTime() - 86400000);

    // ── monthly plans: handled by JS logic.
    // We only fetch rows that are at least 24h old as a quick DB pre-filter
    // because no plan needs a reset if it started less than 24h ago.
    const candidates = await UserUsage.findAll({
      where: {
        periodStart: { [Op.lte]: dailyExpiry },
      },
      include: [{ model: UsagePlan, as: 'plan', foreignKey: 'planName', targetKey: 'planName' }],
    });

    const toReset = candidates.filter(row => {
      if (row.plan.resetPeriod === 'daily') {
        return new Date(row.periodStart) <= dailyExpiry;
      }
      // monthly: check exact calendar month boundary
      const nextReset = new Date(new Date(row.periodStart).setMonth(new Date(row.periodStart).getMonth() + 1));
      return now >= nextReset;
    });

    let count = 0;
    for (const row of toReset) {
      await row.update({ imagesUsed: 0, videosUsed: 0, apiCallsUsed: 0, documentsUsed: 0, periodStart: now, lastResetAt: now });
      count++;
    }

    if (count > 0) {
      await LogService.write({ category: 'system', action: 'scheduled_usage_reset', meta: { usersAffected: count } });
    }

    console.log(`[UsageService] Scheduled reset — affected ${count} users`);
    return count;
  }
}