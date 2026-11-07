import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { ROLES } from './classroom.guards.js';
import { idParam, classIdParam, createGradeBody, listGradesQuery } from './grades.schemas.js';
import * as svc from './grades.service.js';

// Mounted at /api/classroom/grades.
const router = Router();
const graders = requireRole(...ROLES.TEACH_OR_STAFF);

router.post('/', graders, validate({ body: createGradeBody }), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.create(req.user, req.body));
}));

router.get('/', graders, validate({ query: listGradesQuery }), asyncHandler(async (req, res) => {
  res.json(await svc.list(req.query));
}));

router.get('/class/:classId/gradebook', graders, validate({ params: classIdParam }), asyncHandler(async (req, res) => {
  res.json(await svc.gradebook(req.params.classId));
}));

router.delete('/:id', graders, validate({ params: idParam }), asyncHandler(async (req, res) => {
  await svc.remove(req.user, req.params.id);
  res.status(204).end();
}));

export default router;
