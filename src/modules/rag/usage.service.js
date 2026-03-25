// src/services/usage.service.js
//
// CockroachDB does not support PL/pgSQL stored procedures.
// So we handle the check + increment logic here in Node.js
// using a transaction to keep it atomic (no race conditions).

import pool from '../db/pool.js';

export const RESOURCE_TYPES = {
  IMAGE:    'image',
  VIDEO:    'video',
  API_CALL: 'api_call',
  DOCUMENT: 'document',
};

// Maps resource type to the correct DB column names
const RESOURCE_COLUMNS = {
  image:    { used: 'images_used',    limit: 'image_limit' },
  video:    { used: 'videos_used',    limit: 'video_limit' },
  api_call: { used: 'api_calls_used', limit: 'api_call_limit' },
  document: { used: 'documents_used', limit: 'document_limit' },
};

export class UsageService {

  /**
   * THE main gate — checks billing lock + quota then increments.
   * Runs inside a transaction so two simultaneous requests
   * cannot both pass when only 1 slot remains.
   */
  static async checkAndIncrement(userId, resource, quantity = 1) {
    const cols = RESOURCE_COLUMNS[resource];
    if (!cols) throw new Error(`Unknown resource type: ${resource}`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Auto-create row for new users
      await client.query(
        `INSERT INTO user_usage (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );

      // Read current state and lock the row
      const { rows } = await client.query(
        `SELECT
           u.plan_name,
           u.is_locked,
           u.lock_reason,
           u.${cols.used} AS current_used,
           p.${cols.limit} AS plan_limit,
           CASE p.reset_period
             WHEN 'daily'   THEN u.period_start + INTERVAL '1 day'
             WHEN 'monthly' THEN u.period_start + INTERVAL '1 month'
           END AS reset_at
         FROM user_usage u
         JOIN usage_plans p ON p.plan_name = u.plan_name
         WHERE u.user_id = $1
         FOR UPDATE`,
        [userId]
      );

      const row = rows[0];

      // Check 1 — billing lock
      if (row.is_locked) {
        await client.query('ROLLBACK');
        return {
          allowed:     false,
          is_locked:   true,
          lock_reason: row.lock_reason,
          current:     row.current_used,
          limit:       0,
          remaining:   0,
          plan:        row.plan_name,
          reset_at:    row.reset_at,
        };
      }

      // Check 2 — quota
      if (row.current_used + quantity > row.plan_limit) {
        await client.query('ROLLBACK');
        return {
          allowed:   false,
          is_locked: false,
          current:   row.current_used,
          limit:     row.plan_limit,
          remaining: Math.max(row.plan_limit - row.current_used, 0),
          plan:      row.plan_name,
          reset_at:  row.reset_at,
        };
      }

      // All good — increment
      await client.query(
        `UPDATE user_usage
         SET ${cols.used} = ${cols.used} + $1, updated_at = NOW()
         WHERE user_id = $2`,
        [quantity, userId]
      );

      await client.query('COMMIT');

      return {
        allowed:   true,
        is_locked: false,
        current:   row.current_used + quantity,
        limit:     row.plan_limit,
        remaining: row.plan_limit - (row.current_used + quantity),
        plan:      row.plan_name,
        reset_at:  row.reset_at,
      };

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Get full usage summary for a user */
  static async getUserUsageSummary(userId) {
    const { rows } = await pool.query(
      `SELECT
         u.user_id,
         u.plan_name,
         u.is_locked,
         u.lock_reason,
         u.images_used,    p.image_limit,
         u.videos_used,    p.video_limit,
         u.api_calls_used, p.api_call_limit,
         u.documents_used, p.document_limit,
         p.reset_period,
         u.period_start,
         u.last_reset_at,
         CASE p.reset_period
           WHEN 'daily'   THEN u.period_start + INTERVAL '1 day'
           WHEN 'monthly' THEN u.period_start + INTERVAL '1 month'
         END AS next_reset_at
       FROM user_usage u
       JOIN usage_plans p ON p.plan_name = u.plan_name
       WHERE u.user_id = $1`,
      [userId]
    );

    if (!rows.length) {
      await pool.query(
        `INSERT INTO user_usage (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
      return this.getUserUsageSummary(userId);
    }

    const row = rows[0];
    return {
      plan:        row.plan_name,
      isLocked:    row.is_locked,
      lockReason:  row.lock_reason,
      resetPeriod: row.reset_period,
      nextResetAt: row.next_reset_at,
      lastResetAt: row.last_reset_at,
      periodStart: row.period_start,
      resources: {
        images:    { used: row.images_used,    limit: row.image_limit,    remaining: row.image_limit    - row.images_used },
        videos:    { used: row.videos_used,    limit: row.video_limit,    remaining: row.video_limit    - row.videos_used },
        apiCalls:  { used: row.api_calls_used, limit: row.api_call_limit, remaining: row.api_call_limit - row.api_calls_used },
        documents: { used: row.documents_used, limit: row.document_limit, remaining: row.document_limit - row.documents_used },
      },
    };
  }

  /** Change a user's plan — call after successful payment */
  static async setUserPlan(userId, planName) {
    const { rows } = await pool.query(
      `UPDATE user_usage SET plan_name = $1, updated_at = NOW()
       WHERE user_id = $2 RETURNING plan_name`,
      [planName, userId]
    );
    if (!rows.length) throw new Error(`No usage row for user ${userId}`);
    return rows[0].plan_name;
  }

  /** Billing lock — blocks ALL agent calls */
  static async lockUser(userId, reason = 'Account locked by admin') {
    await pool.query(
      `UPDATE user_usage
       SET is_locked = TRUE, lock_reason = $1, updated_at = NOW()
       WHERE user_id = $2`,
      [reason, userId]
    );
  }

  /** Remove billing lock */
  static async unlockUser(userId) {
    await pool.query(
      `UPDATE user_usage
       SET is_locked = FALSE, lock_reason = NULL, updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
  }

  /** Reset a user's counters manually (admin action) */
  static async resetUserUsage(userId) {
    await pool.query(
      `UPDATE user_usage
       SET images_used    = 0,
           videos_used    = 0,
           api_calls_used = 0,
           documents_used = 0,
           period_start   = NOW(),
           last_reset_at  = NOW(),
           updated_at     = NOW()
       WHERE user_id = $1`,
      [userId]
    );
  }

  /** Called hourly by scheduler — resets all expired windows */
  static async runScheduledReset() {
    const { rows } = await pool.query(
      `UPDATE user_usage u
       SET images_used    = 0,
           videos_used    = 0,
           api_calls_used = 0,
           documents_used = 0,
           period_start   = NOW(),
           last_reset_at  = NOW(),
           updated_at     = NOW()
       FROM usage_plans p
       WHERE u.plan_name = p.plan_name
         AND (
           (p.reset_period = 'daily'   AND u.period_start + INTERVAL '1 day'   <= NOW())
           OR
           (p.reset_period = 'monthly' AND u.period_start + INTERVAL '1 month' <= NOW())
         )
       RETURNING u.user_id`
    );
    const count = rows.length;
    console.log(`[UsageService] Scheduled reset — affected ${count} users`);
    return count;
  }
}
