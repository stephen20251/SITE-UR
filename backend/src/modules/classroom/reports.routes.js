import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireRole } from '../../middlewares/auth.js';
import { ROLES } from './classroom.guards.js';
import * as svc from './reports.service.js';

// Mounted at /api/classroom/reports.
const router = Router();

router.get('/overview', requireRole(...ROLES.MANAGE_STRUCTURE), asyncHandler(async (req, res) => {
  res.json(await svc.overview());
}));

export default router;
