import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { ROLES } from './classroom.guards.js';
import { markAttendanceBody, listAttendanceQuery, classIdParam } from './attendance.schemas.js';
import * as svc from './attendance.service.js';

// Mounted at /api/classroom/attendance.
const router = Router();
const markers = requireRole(...ROLES.TEACH_OR_STAFF);

router.post('/', markers, validate({ body: markAttendanceBody }), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.mark(req.user, req.body));
}));

router.get('/', markers, validate({ query: listAttendanceQuery }), asyncHandler(async (req, res) => {
  res.json(await svc.listForClass(req.query));
}));

router.get('/class/:classId/summary', markers, validate({ params: classIdParam }), asyncHandler(async (req, res) => {
  res.json(await svc.classSummary(req.params.classId));
}));

export default router;
