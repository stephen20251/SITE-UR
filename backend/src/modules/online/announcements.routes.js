import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireSystem } from '../../middlewares/auth.js';
import * as svc from './announcements.service.js';
import * as gam from './gamification.service.js';

const r = Router();
const online = requireSystem('ONLINE');

// ── Course announcements ──
r.get('/courses/:courseId/announcements', online, asyncHandler(async (req, res) => {
  res.json(await svc.listAnnouncements(req.user, req.params.courseId));
}));

r.post('/courses/:courseId/announcements', online, asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createAnnouncement(req.user, req.params.courseId, req.body ?? {}));
}));

r.patch('/announcements/:id', online, asyncHandler(async (req, res) => {
  res.json(await svc.updateAnnouncement(req.user, req.params.id, req.body ?? {}));
}));

r.delete('/announcements/:id', online, asyncHandler(async (req, res) => {
  res.json(await svc.deleteAnnouncement(req.user, req.params.id));
}));

// ── Gamification ──
r.get('/gamification/me', online, asyncHandler(async (req, res) => {
  res.json(await gam.myGamification(req.user.sub));
}));

r.get('/gamification/leaderboard', online, asyncHandler(async (req, res) => {
  res.json(await gam.leaderboard(Math.min(25, Number(req.query.limit) || 10)));
}));

export default r;
