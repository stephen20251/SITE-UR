import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middlewares/auth.js';
import * as svc from './pricing.service.js';

// Monté sur /api/online/pricing
const r = Router();
r.use(authenticate);

function requireSuperAdmin(req, res, next) {
  if (req.user.systemRole !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Réservé au Super Admin' });
  next();
}

// ── Lecture (tout utilisateur connecté) ─────────────────────────────────────
r.get('/packs', asyncHandler(async (req, res) => {
  const admin = req.user.systemRole === 'SUPER_ADMIN';
  res.json(await svc.listPacks({ courseId: req.query.courseId, activeOnly: !admin || req.query.active === '1' }));
}));

r.post('/packs/:id/purchase', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.purchasePack(req.user.sub, req.params.id, req.body));
}));

// ── Administration des prix ─────────────────────────────────────────────────
r.get('/courses', requireSuperAdmin, asyncHandler(async (req, res) => {
  res.json(await svc.listSellableCourses(req.query));
}));

r.patch('/courses/:id/price', requireSuperAdmin, asyncHandler(async (req, res) => {
  res.json(await svc.setCoursePrice(req.params.id, req.body.price));
}));

r.post('/packs', requireSuperAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createPack(req.body));
}));

r.put('/packs/:id', requireSuperAdmin, asyncHandler(async (req, res) => {
  res.json(await svc.updatePack(req.params.id, req.body));
}));

r.delete('/packs/:id', requireSuperAdmin, asyncHandler(async (req, res) => {
  await svc.deletePack(req.params.id);
  res.status(204).end();
}));

export default r;
