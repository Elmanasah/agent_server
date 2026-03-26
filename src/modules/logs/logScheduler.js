// src/modules/logs/logScheduler.js
//
// Runs every hour (at :15 past the hour — offset from usageScheduler
// which runs at :00 to spread DB load).
// Deletes all log rows whose expiresAt has passed.

import cron from 'node-cron';
import { LogService } from './log.service.js';

let started = false;

export function initLogScheduler() {
  if (started) return;
  started = true;

  cron.schedule('15 * * * *', async () => {
    try {
      const deleted = await LogService.purgeExpired();
      if (deleted > 0) {
        console.log(`[LogScheduler] Purged ${deleted} expired log(s) at ${new Date().toISOString()}`);
      }
    } catch (err) {
      console.error('[LogScheduler] Purge failed:', err.message);
    }
  });

  console.log('[LogScheduler] Log purge job registered (runs every hour at :15).');
}
