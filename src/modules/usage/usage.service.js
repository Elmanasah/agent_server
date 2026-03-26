import sequelize from '../../db/index.js';
import UserUsage from './userUsage.model.js';
import UsagePlan from './usagePlan.model.js';

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

  static async _getOrCreateUsageRow(userId, transaction) {
    const [row] = await UserUsage.findOrCreate({
      where: { userId },
      defaults: { userId, planName: 'free' },
      transaction,
    });
    return row;
  }

  static async checkAndIncrement(userId, resource, quantity = 1) {
    const cols = RESOURCE_COLUMNS[resource];
    if (!cols) throw new Error(`Unknown resource type: ${resource}`);

    return await sequelize.transaction(async (t) => {
      const usageRow = await UserUsage.findOne({
        where: { userId },
        include: [{ model: UsagePlan, as: 'plan', foreignKey: 'planName', targetKey: 'planName' }],
        lock: t.LOCK.UPDATE,
        transaction: t,
      }) || await this._getOrCreateUsageRow(userId, t);

      // Reload with plan if just created
      const row = usageRow.plan
        ? usageRow
        : await UserUsage.findOne({
            where: { userId },
            include: [{ model: UsagePlan, as: 'plan', foreignKey: 'planName', targetKey: 'planName' }],
            lock: t.LOCK.UPDATE,
            transaction: t,
          });

      const plan = row.plan;
      const currentUsed = row[cols.used];
      const planLimit   = plan[cols.limit];
      const resetAt     = plan.resetPeriod === 'daily'
        ? new Date(new Date(row.periodStart).getTime() + 86400000)
        : new Date(new Date(row.periodStart).setMonth(new Date(row.periodStart).getMonth() + 1));

      if (row.isLocked) {
        return { allowed: false, is_locked: true, lock_reason: row.lockReason, current: currentUsed, limit: 0, remaining: 0, plan: row.planName, reset_at: resetAt };
      }

      if (currentUsed + quantity > planLimit) {
        return { allowed: false, is_locked: false, current: currentUsed, limit: planLimit, remaining: Math.max(planLimit - currentUsed, 0), plan: row.planName, reset_at: resetAt };
      }

      await row.increment(cols.used, { by: quantity, transaction: t });

      return { allowed: true, is_locked: false, current: currentUsed + quantity, limit: planLimit, remaining: planLimit - (currentUsed + quantity), plan: row.planName, reset_at: resetAt };
    });
  }

  static async getUserUsageSummary(userId) {
    let row = await UserUsage.findOne({
      where: { userId },
      include: [{ model: UsagePlan, as: 'plan', foreignKey: 'planName', targetKey: 'planName' }],
    });

    if (!row) {
      await UserUsage.findOrCreate({ where: { userId }, defaults: { userId } });
      return this.getUserUsageSummary(userId);
    }

    const { plan } = row;
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
    const [updated] = await UserUsage.update({ planName }, { where: { userId } });
    if (!updated) throw new Error(`No usage row found for user ${userId}`);
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
    const rows = await UserUsage.findAll({
      include: [{ model: UsagePlan, as: 'plan', foreignKey: 'planName', targetKey: 'planName' }],
    });

    let count = 0;
    for (const row of rows) {
      const expired =
        (row.plan.resetPeriod === 'daily'   && now - new Date(row.periodStart) >= 86400000) ||
        (row.plan.resetPeriod === 'monthly' && now >= new Date(new Date(row.periodStart).setMonth(new Date(row.periodStart).getMonth() + 1)));

      if (expired) {
        await row.update({ imagesUsed: 0, videosUsed: 0, apiCallsUsed: 0, documentsUsed: 0, periodStart: now, lastResetAt: now });
        count++;
      }
    }
    console.log(`[UsageService] Scheduled reset — affected ${count} users`);
    return count;
  }
}