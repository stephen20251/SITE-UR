import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireSystem, isOnlineTeacher } from '../../middlewares/auth.js';
import * as svc from './learning-paths.service.js';

const r = Router();

// Student: paths with enrollment state
r.get('/paths/for-me', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.pathsForStudent(req.user.sub));
}));

// Public list (published only) — any online user
r.get('/paths', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  const published = !isOnlineTeacher(req.user);
  res.json(await svc.listPaths({ published }));
}));

// Get one path
r.get('/paths/:pathId', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.getPath(req.params.pathId));
}));

// Teacher/admin: create path
r.post('/paths', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createPath(req.user.sub, req.body));
}));

// Teacher/admin: update path
r.patch('/paths/:pathId', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.updatePath(req.params.pathId, req.user.sub, req.body));
}));

// Teacher/admin: delete path
r.delete('/paths/:pathId', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  await svc.deletePath(req.params.pathId, req.user.sub);
  res.json({ ok: true });
}));

export default r;
