// src/modules/usagePlan/usagePlan.routes.js
//
// Admin CRUD for usage plans.
// All routes require: authenticated + admin role.

import { Router } from 'express';
import verifyToken from '../../middleware/verifyToken.js';
import { allowTo } from '../../middleware/allowTo.js';
import {
  getAllPlans,
  getPlanByName,
  createPlan,
  updatePlan,
  deletePlan,
} from './usagePlan.controller.js';

const router = Router();

// All plan routes require admin
router.use(verifyToken, allowTo('admin'));

router.get('/',       getAllPlans);
router.get('/:name',  getPlanByName);
router.post('/',      createPlan);
router.patch('/:name', updatePlan);
router.delete('/:name', deletePlan);

export default router;
