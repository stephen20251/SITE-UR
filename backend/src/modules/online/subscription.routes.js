import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireSystem } from '../../middlewares/auth.js';
import * as svc from './subscription.service.js';

const r = Router();
const online = requireSystem('ONLINE');

// ── Plans ──
r.get('/subscription/plans', online, asyncHandler(async (req, res) => {
  res.json(await svc.listActivePlans());
}));

r.get('/subscription/plans/all', online, asyncHandler(async (req, res) => {
  res.json(await svc.listAllPlans(req.user.sub));
}));

r.post('/subscription/plans', online, asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createPlan(req.user.sub, req.body ?? {}));
}));

r.patch('/subscription/plans/:id', online, asyncHandler(async (req, res) => {
  res.json(await svc.updatePlan(req.user.sub, req.params.id, req.body ?? {}));
}));

r.delete('/subscription/plans/:id', online, asyncHandler(async (req, res) => {
  res.json(await svc.deletePlan(req.user.sub, req.params.id));
}));

// ── Student ──
r.get('/subscription/me', online, asyncHandler(async (req, res) => {
  res.json(await svc.activeSubscription(req.user.sub));
}));

r.get('/subscription/mine', online, asyncHandler(async (req, res) => {
  res.json(await svc.mySubscriptions(req.user.sub));
}));

r.post('/subscription/subscribe', online, asyncHandler(async (req, res) => {
  res.status(201).json(await svc.subscribe(req.user.sub, req.body ?? {}));
}));

// ── Admin ──
r.get('/subscription/admin/list', online, asyncHandler(async (req, res) => {
  res.json(await svc.listSubscriptions(req.user.sub, {
    status: req.query.status,
    page: Number(req.query.page) || 1,
    limit: Math.min(50, Number(req.query.limit) || 20),
  }));
}));

r.get('/subscription/admin/stats', online, asyncHandler(async (req, res) => {
  res.json(await svc.subscriptionStats(req.user.sub));
}));

r.post('/subscription/admin/:id/validate', online, asyncHandler(async (req, res) => {
  res.json(await svc.validateSubscription(req.user.sub, req.params.id));
}));

r.post('/subscription/admin/:id/refuse', online, asyncHandler(async (req, res) => {
  res.json(await svc.refuseSubscription(req.user.sub, req.params.id, req.body?.reason));
}));

export default r;
