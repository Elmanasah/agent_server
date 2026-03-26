import { Router } from 'express';
import { allowTo } from '../../middleware/allowTo.js';
import {
    getMyUsage,
    getUserUsage,
    updateUserPlan,
    resetUserUsage,
    lockUserAccount,
    unlockUserAccount,
    runScheduledReset,
} from './usage.controller.js';

const router = Router();

// Current user
router.get('/me', getMyUsage);

// Admin only
router.use('/admin', allowTo('admin'));
router.get('/admin/:userId',         getUserUsage);
router.patch('/admin/:userId/plan',  updateUserPlan);
router.post('/admin/:userId/reset',  resetUserUsage);
router.post('/admin/:userId/lock',   lockUserAccount);
router.post('/admin/:userId/unlock', unlockUserAccount);
router.post('/admin/reset-all',      runScheduledReset);

export default router;