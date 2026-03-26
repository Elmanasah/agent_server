// src/modules/logs/log.service.js
//
// Simple explanation:
//   LogService.write()       → create a log entry (2-day TTL)
//   LogService.getForUser()  → paginated history for a user
//   LogService.getAll()      → admin: all logs with filters
//   LogService.purgeExpired()→ delete rows past their expiresAt

import { Op } from 'sequelize';
import Log from './log.model.js';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export class LogService {

  // ── Write a log entry ───────────────────────────────────────────
  //
  // Usage:
  //   await LogService.write({ userId, category: 'auth', action: 'login', req })
  //   await LogService.write({ category: 'system', action: 'scheduler_ran', meta: { count: 5 } })
  //
  static async write({ userId = null, category, action, meta = null, statusCode = null, req = null }) {
    const now = new Date();
    return Log.create({
      userId,
      category,
      action,
      meta,
      statusCode,
      ip:        req?.ip ?? req?.headers?.['x-forwarded-for'] ?? null,
      userAgent: req?.headers?.['user-agent'] ?? null,
      expiresAt: new Date(now.getTime() + TWO_DAYS_MS),
    });
  }

  // ── Get logs for a specific user ────────────────────────────────
  static async getForUser(userId, { page = 1, limit = 20, category = null } = {}) {
    const where = { userId };
    if (category) where.category = category;

    const offset = (page - 1) * limit;
    const { rows, count } = await Log.findAndCountAll({
      where,
      order:  [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return { logs: rows, total: count, page, limit, pages: Math.ceil(count / limit) };
  }

  // ── Admin: get all logs with optional filters ───────────────────
  static async getAll({ page = 1, limit = 50, category = null, userId = null } = {}) {
    const where = {};
    if (category) where.category = category;
    if (userId)   where.userId   = userId;

    const offset = (page - 1) * limit;
    const { rows, count } = await Log.findAndCountAll({
      where,
      order:  [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return { logs: rows, total: count, page, limit, pages: Math.ceil(count / limit) };
  }

  // ── Purge expired rows ──────────────────────────────────────────
  // Called by logScheduler.js every hour.
  static async purgeExpired() {
    const deleted = await Log.destroy({
      where: { expiresAt: { [Op.lte]: new Date() } },
    });
    console.log(`[LogService] Purged ${deleted} expired log(s)`);
    return deleted;
  }
}
