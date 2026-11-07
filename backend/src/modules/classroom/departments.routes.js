import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { ROLES } from './classroom.guards.js';
import { idParam, createDepartmentBody, updateDepartmentBody } from './departments.schemas.js';
import * as svc from './departments.service.js';

// Mounted at /api/classroom/departments (parent enforces auth + CLASSROOM system).
const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json(await svc.list());
}));

router.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  res.json(await svc.get(req.params.id));
}));

router.post('/', requireRole(...ROLES.ADMIN), validate({ body: createDepartmentBody }), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.create(req.body));
}));

router.patch('/:id', requireRole(...ROLES.ADMIN), validate({ params: idParam, body: updateDepartmentBody }), asyncHandler(async (req, res) => {
  res.json(await svc.update(req.params.id, req.body));
}));

router.delete('/:id', requireRole(...ROLES.ADMIN), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await svc.remove(req.params.id);
  res.status(204).end();
}));

export default router;
