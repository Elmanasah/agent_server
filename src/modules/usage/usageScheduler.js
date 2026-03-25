// src/modules/usage/usageScheduler.js
//
// Runs every hour and resets usage counters for users
// whose daily/monthly period has expired.

import cron from 'node-cron';
import { UsageService } from './usage.service.js';

let started = false;

export function initUsageScheduler() {
  if (started) return;
  started = true;

  cron.schedule('0 * * * *', async () => {
    try {
      const count = await UsageService.runScheduledReset();
      if (count > 0) {
        console.log(`[Scheduler] Reset ${count} user(s) at ${new Date().toISOString()}`);
      }
    } catch (err) {
      console.error('[Scheduler] Reset failed:', err.message);
    }
  });

  console.log('[Scheduler] Usage reset job registered (runs every hour).');
}