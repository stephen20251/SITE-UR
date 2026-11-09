import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';
import { requireSystem } from '../../middlewares/auth.js';
import { prisma } from '../../database/prisma.js';
import * as svc from './live-sessions.service.js';
import { uploadsPath } from '../../config/paths.js';

const r = Router();

// Presentation uploads (PDF shown on the live blackboard)
const presDir = uploadsPath('presentations');
if (!fs.existsSync(presDir)) fs.mkdirSync(presDir, { recursive: true });
const presUpload = multer({
  storage: multer.diskStorage({
    destination: presDir,
    filename: (_, file, cb) => cb(null, `pres-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname) || '.pdf'}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_, file, cb) => cb(null, file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')),
});

// Student: upcoming sessions across all enrolled courses
r.get('/live-sessions/my', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.myUpcomingSessions(req.user.sub));
}));

// Get sessions for a course (teacher or enrolled student)
r.get('/courses/:courseId/live-sessions', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.listForCourse(req.params.courseId, req.user));
}));

// Teacher: create session
r.post('/courses/:courseId/live-sessions', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createSession(req.params.courseId, req.user.sub, req.body));
}));

// Teacher: update session
r.patch('/live-sessions/:sessionId', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.updateSession(req.params.sessionId, req.user.sub, req.body));
}));

// Teacher: delete session
r.delete('/live-sessions/:sessionId', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  await svc.deleteSession(req.params.sessionId, req.user.sub);
  res.json({ ok: true });
}));

// Teacher: upload the presentation PDF shown on the session's blackboard
r.post('/live-sessions/:sessionId/presentation', requireSystem('ONLINE'), presUpload.single('file'), asyncHandler(async (req, res) => {
  const session = await prisma.liveSession.findUnique({
    where: { id: req.params.sessionId },
    select: { teacherId: true },
  });
  if (!session) throw new HttpError(404, 'Session introuvable');
  const isAdmin = req.user.systemRole === 'SUPER_ADMIN' || req.user.role === 'SUPER_ADMIN';
  if (session.teacherId !== req.user.sub && !isAdmin) throw new HttpError(403, 'Réservé à l\'enseignant de la session');
  if (!req.file) throw new HttpError(400, 'Fichier PDF ou image requis (exportez votre PowerPoint en PDF)');
  res.status(201).json({
    url: `/uploads/presentations/${req.file.filename}`,
    kind: req.file.mimetype.startsWith('image/') ? 'image' : 'pdf',
  });
}));

export default r;
