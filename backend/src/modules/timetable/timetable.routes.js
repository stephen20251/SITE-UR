import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate, requireRole, requireSystem } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { ROLES } from '../classroom/classroom.guards.js';
import { idParam, classIdParam, createEntryBody, updateEntryBody, timetableQuery, rejectBody } from './timetable.schemas.js';
import * as svc from './timetable.service.js';

// Mounted at /api/timetable.
const router = Router();
router.use(authenticate, requireSystem('CLASSROOM'));

const authors = requireRole(...ROLES.TEACH_OR_STAFF);
const approvers = requireRole(...ROLES.APPROVE_TIMETABLE);

// ─── Entry authoring (teacher/staff) ───
router.post('/entries', authors, validate({ body: createEntryBody }), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createEntry(req.user, req.body));
}));

router.patch('/entries/:id', authors, validate({ params: idParam, body: updateEntryBody }), asyncHandler(async (req, res) => {
  res.json(await svc.updateEntry(req.user, req.params.id, req.body));
}));

router.delete('/entries/:id', authors, validate({ params: idParam }), asyncHandler(async (req, res) => {
  await svc.deleteEntry(req.user, req.params.id);
  res.status(204).end();
}));

// ─── Class timetable (students see PUBLISHED for their own class) ───
router.get('/class/:classId', validate({ params: classIdParam, query: timetableQuery }), asyncHandler(async (req, res) => {
  res.json(await svc.classTimetable(req.user, req.params.classId, req.query));
}));

// ─── Workflow: draft → submit → approve/reject → publish ───
router.post('/class/:classId/submit', authors, validate({ params: classIdParam }), asyncHandler(async (req, res) => {
  res.json(await svc.submit(req.user, req.params.classId));
}));

router.post('/class/:classId/approve', approvers, validate({ params: classIdParam }), asyncHandler(async (req, res) => {
  res.json(await svc.approve(req.user, req.params.classId));
}));

router.post('/class/:classId/reject', approvers, validate({ params: classIdParam, body: rejectBody }), asyncHandler(async (req, res) => {
  res.json(await svc.reject(req.user, req.params.classId, req.body.reason));
}));

router.post('/class/:classId/publish', approvers, validate({ params: classIdParam }), asyncHandler(async (req, res) => {
  res.json(await svc.publish(req.user, req.params.classId));
}));

export default router;
