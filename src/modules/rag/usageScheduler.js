// src/services/usageScheduler.js
//
// Runs every hour and resets usage counters for users
// whose daily/monthly period has expired.
//
// Simple explanation:
//   Every hour → check database → find users whose timer ran out
//   → reset their counters to 0 → they can use the app again

import cron from 'node-cron';
import { UsageService } from './usage.service.js';

let started = false;

export function initUsageScheduler() {
  // Prevent registering the job twice if called more than once
  if (started) return;
  started = true;

  // Run at the start of every hour (e.g. 1:00, 2:00, 3:00...)
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