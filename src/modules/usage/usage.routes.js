import { Router } from 'express';
import { allowTo } from '../../middleware/allowTo.js';
import verifyToken from '../../middleware/verifyToken.js';
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
router.get('/me', verifyToken, getMyUsage);

// Admin only — verifyToken here as defense-in-depth (also applied at app.js mount)
router.use('/admin', verifyToken, allowTo('admin'));
router.post('/admin/reset-all',      runScheduledReset);
router.get('/admin/:userId',         getUserUsage);
router.patch('/admin/:userId/plan',  updateUserPlan);
router.post('/admin/:userId/reset',  resetUserUsage);
router.post('/admin/:userId/lock',   lockUserAccount);
router.post('/admin/:userId/unlock', unlockUserAccount);

export default router;