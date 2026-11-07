import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireSystem } from '../../middlewares/auth.js';
import * as svc from './qa.service.js';

const r = Router();
const online = requireSystem('ONLINE');

// ─── Questions ───
r.get('/courses/:courseId/questions', online, asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page ?? 1), 1);
  const limit = Math.min(Number(req.query.limit ?? 20), 50);
  const resolved = req.query.resolved === 'true' ? true : req.query.resolved === 'false' ? false : undefined;
  res.json(await svc.listQuestions(req.user, req.params.courseId, { lessonId: req.query.lessonId, resolved, page, limit }));
}));

r.post('/courses/:courseId/questions', online, asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createQuestion(req.user, req.params.courseId, req.body ?? {}));
}));

r.get('/questions/:id', online, asyncHandler(async (req, res) => {
  res.json(await svc.getQuestion(req.user, req.params.id));
}));

r.delete('/questions/:id', online, asyncHandler(async (req, res) => {
  res.json(await svc.deleteQuestion(req.user, req.params.id));
}));

r.post('/questions/:id/upvote', online, asyncHandler(async (req, res) => {
  res.json(await svc.upvoteQuestion(req.user, req.params.id));
}));

r.patch('/questions/:id/resolved', online, asyncHandler(async (req, res) => {
  res.json(await svc.setResolved(req.user, req.params.id, req.body?.resolved));
}));

// ─── Answers ───
r.post('/questions/:id/answers', online, asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createAnswer(req.user, req.params.id, req.body ?? {}));
}));

r.delete('/answers/:id', online, asyncHandler(async (req, res) => {
  res.json(await svc.deleteAnswer(req.user, req.params.id));
}));

r.post('/answers/:id/upvote', online, asyncHandler(async (req, res) => {
  res.json(await svc.upvoteAnswer(req.user, req.params.id));
}));

r.post('/answers/:id/accept', online, asyncHandler(async (req, res) => {
  res.json(await svc.acceptAnswer(req.user, req.params.id));
}));

export default r;
