import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { ROLES } from './classroom.guards.js';
import { idParam, studentParam, listClassesQuery, createClassBody, updateClassBody, assignStudentBody } from './classes.schemas.js';
import * as svc from './classes.service.js';

// Mounted at /api/classroom/classes (parent enforces auth + CLASSROOM system).
const router = Router();

const staff = requireRole(...ROLES.MANAGE_STRUCTURE);
const readers = requireRole(...ROLES.TEACH_OR_STAFF);

router.get('/', readers, validate({ query: listClassesQuery }), asyncHandler(async (req, res) => {
  res.json(await svc.list(req.query));
}));

router.get('/:id', readers, validate({ params: idParam }), asyncHandler(async (req, res) => {
  res.json(await svc.get(req.params.id));
}));

router.post('/', staff, validate({ body: createClassBody }), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.create(req.body));
}));

router.patch('/:id', staff, validate({ params: idParam, body: updateClassBody }), asyncHandler(async (req, res) => {
  res.json(await svc.update(req.params.id, req.body));
}));

router.delete('/:id', requireRole(...ROLES.ADMIN), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await svc.remove(req.params.id);
  res.status(204).end();
}));

// ─── Roster ───
router.get('/:id/students', readers, validate({ params: idParam }), asyncHandler(async (req, res) => {
  res.json(await svc.roster(req.params.id));
}));

router.post('/:id/students', staff, validate({ params: idParam, body: assignStudentBody }), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.assignStudent(req.params.id, req.body.studentId));
}));

router.delete('/:id/students/:userId', staff, validate({ params: studentParam }), asyncHandler(async (req, res) => {
  await svc.removeStudent(req.params.id, req.params.userId);
  res.status(204).end();
}));

export default router;
