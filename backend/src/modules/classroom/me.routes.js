import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireRole } from '../../middlewares/auth.js';
import { ROLES } from './classroom.guards.js';
import * as svc from './me.service.js';

// Mounted at /api/classroom/me — the signed-in user's own classroom data.
const router = Router();
const studentOnly = requireRole(...ROLES.STUDENT);

router.get('/profile', asyncHandler(async (req, res) => {
  res.json(await svc.myProfile(req.user));
}));

// Student + teacher (service branches on role).
router.get('/timetable', asyncHandler(async (req, res) => {
  res.json(await svc.myTimetable(req.user));
}));

router.get('/class', studentOnly, asyncHandler(async (req, res) => {
  res.json(await svc.myClass(req.user));
}));

router.get('/attendance', studentOnly, asyncHandler(async (req, res) => {
  res.json(await svc.myAttendance(req.user));
}));

router.get('/grades', studentOnly, asyncHandler(async (req, res) => {
  res.json(await svc.myGrades(req.user));
}));

// ─── Parent routes ───
const parentOnly = requireRole('PARENT');

router.get('/children', parentOnly, asyncHandler(async (req, res) => {
  res.json(await svc.myChildren(req.user));
}));

router.get('/children/:childId/grades', parentOnly, asyncHandler(async (req, res) => {
  res.json(await svc.childGrades(req.user, req.params.childId));
}));

router.get('/children/:childId/attendance', parentOnly, asyncHandler(async (req, res) => {
  res.json(await svc.childAttendance(req.user, req.params.childId));
}));

export default router;
