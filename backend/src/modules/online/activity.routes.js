import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireSystem } from '../../middlewares/auth.js';
import * as svc from './activity.service.js';
import { recommendations } from './courses.service.js';

const r = Router();

r.get('/activity', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 20), 50);
  res.json(await svc.myActivity(req.user.sub, limit));
}));

r.get('/activity/weekly', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.weeklyActivity(req.user.sub));
}));

r.get('/stats', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.studentStats(req.user.sub));
}));

r.get('/recommendations', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await recommendations(req.user.sub, Math.min(12, Number(req.query.limit) || 8)));
}));

export default r;
