import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as svc from './affectation.service.js';

const r = Router();
r.use(authenticate);

// GET /api/affectation — list assignments with filters
r.get('/', asyncHandler(async (req, res) => {
  const { semesterId, mentionId, subjectId, teacherId, page, limit } = req.query;
  res.json(await svc.listAssignments({ semesterId, mentionId, subjectId, teacherId, page: Number(page ?? 1), limit: Number(limit ?? 50) }));
}));

// GET /api/affectation/subjects — subjects with their current assignments
r.get('/subjects', asyncHandler(async (req, res) => {
  const { mentionId, semesterId } = req.query;
  res.json(await svc.listSubjectsForAssignment({ mentionId, semesterId }));
}));

// GET /api/affectation/subject/:subjectId
r.get('/subject/:subjectId', asyncHandler(async (req, res) => {
  res.json(await svc.listBySubject(req.params.subjectId));
}));

// POST /api/affectation — assign teacher
r.post('/', asyncHandler(async (req, res) => {
  const result = await svc.assignTeacher({ ...req.body, assignedBy: req.user.sub });
  res.status(201).json(result);
}));

// PATCH /api/affectation/:id
r.patch('/:id', asyncHandler(async (req, res) => {
  res.json(await svc.updateAssignment(req.params.id, req.body));
}));

// DELETE /api/affectation/:id
r.delete('/:id', asyncHandler(async (req, res) => {
  res.json(await svc.removeAssignment(req.params.id));
}));

export default r;
