import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as svc from './announcements.service.js';

const r = Router();
r.use(authenticate);

// Feed
r.get('/', asyncHandler(async (req, res) => {
  const { status, category, page, limit } = req.query;
  res.json(await svc.list(req.user, {
    status, category,
    page: page ? parseInt(page) : 1,
    limit: limit ? parseInt(limit) : 20,
  }));
}));

r.get('/audiences', asyncHandler(async (req, res) => {
  res.json(await svc.audiences(req.user));
}));

r.get('/:id', asyncHandler(async (req, res) => {
  res.json(await svc.getById(req.user, req.params.id));
}));

r.post('/', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.create(req.user, req.body));
}));

r.put('/:id', asyncHandler(async (req, res) => {
  res.json(await svc.update(req.user, req.params.id, req.body));
}));

r.delete('/:id', asyncHandler(async (req, res) => {
  await svc.remove(req.user, req.params.id);
  res.status(204).end();
}));

// Read tracking
r.post('/:id/read', asyncHandler(async (req, res) => {
  await svc.markRead(req.user, req.params.id);
  res.json({ ok: true });
}));

r.post('/:id/confirm', asyncHandler(async (req, res) => {
  await svc.markConfirmed(req.user, req.params.id);
  res.json({ ok: true });
}));

// Comments
r.post('/:id/comments', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.addComment(req.user, req.params.id, req.body.content));
}));

r.delete('/comments/:commentId', asyncHandler(async (req, res) => {
  await svc.deleteComment(req.user, req.params.commentId);
  res.status(204).end();
}));

// Stats (creator / admin only)
r.get('/:id/stats', asyncHandler(async (req, res) => {
  res.json(await svc.stats(req.user, req.params.id));
}));

export default r;
