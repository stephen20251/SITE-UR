import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireSystem } from '../../middlewares/auth.js';
import * as svc from './notes.service.js';

const r = Router();
const online = requireSystem('ONLINE');

// List the student's own notes/bookmarks (filter by course/lesson/bookmarksOnly).
r.get('/notes', online, asyncHandler(async (req, res) => {
  res.json(await svc.listNotes(req.user.sub, {
    courseId: req.query.courseId,
    lessonId: req.query.lessonId,
    bookmarksOnly: req.query.bookmarksOnly === 'true',
  }));
}));

r.post('/notes', online, asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createNote(req.user.sub, req.body ?? {}));
}));

r.patch('/notes/:id', online, asyncHandler(async (req, res) => {
  res.json(await svc.updateNote(req.user.sub, req.params.id, req.body ?? {}));
}));

r.delete('/notes/:id', online, asyncHandler(async (req, res) => {
  res.json(await svc.deleteNote(req.user.sub, req.params.id));
}));

export default r;
