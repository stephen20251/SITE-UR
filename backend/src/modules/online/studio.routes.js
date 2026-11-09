import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import * as svc from './studio.service.js';
import { uploadsPath } from '../../config/paths.js';

const lessonMediaDir = uploadsPath('lessons');
if (!fs.existsSync(lessonMediaDir)) fs.mkdirSync(lessonMediaDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: lessonMediaDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `lesson-${req.params.lessonId ?? 'file'}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
});

const router = Router();
router.use(authenticate);
const teacherOnly = requireRole('TEACHER_ONLINE');

// ─── Versions ───────────────────────────────────────────────────────────────
router.get('/courses/:courseId/versions', teacherOnly, asyncHandler(async (req, res) => {
  res.json(await svc.listVersions(req.params.courseId, req.user.sub));
}));

router.post('/courses/:courseId/versions', teacherOnly, asyncHandler(async (req, res) => {
  res.status(201).json(await svc.saveVersion(req.params.courseId, req.user.sub, req.body.label));
}));

router.post('/courses/:courseId/versions/:versionNum/restore', teacherOnly, asyncHandler(async (req, res) => {
  res.json(await svc.restoreVersion(req.params.courseId, req.user.sub, Number(req.params.versionNum)));
}));

// ─── Comments ───────────────────────────────────────────────────────────────
router.get('/courses/:courseId/comments', asyncHandler(async (req, res) => {
  res.json(await svc.listComments(req.params.courseId, req.user.sub));
}));

router.post('/courses/:courseId/comments', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.addComment(req.params.courseId, req.user.sub, req.body));
}));

router.patch('/comments/:commentId/resolve', asyncHandler(async (req, res) => {
  res.json(await svc.resolveComment(req.params.commentId, req.user.sub));
}));

router.delete('/comments/:commentId', asyncHandler(async (req, res) => {
  await svc.deleteComment(req.params.commentId, req.user.sub);
  res.status(204).end();
}));

// ─── Lesson files ────────────────────────────────────────────────────────────
router.get('/lessons/:lessonId/files', asyncHandler(async (req, res) => {
  res.json(await svc.listLessonFiles(req.params.lessonId, req.user.sub));
}));

router.post('/lessons/:lessonId/files/upload', teacherOnly, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/lessons/${req.file.filename}`;
  const file = await svc.addLessonFile(req.params.lessonId, req.user.sub, {
    name: req.body.name ?? req.file.originalname,
    url,
    mimeType: req.file.mimetype,
    size: req.file.size,
    allowDownload: req.body.allowDownload !== 'false',
  });
  res.status(201).json(file);
}));

router.delete('/lesson-files/:fileId', teacherOnly, asyncHandler(async (req, res) => {
  await svc.deleteLessonFile(req.params.fileId, req.user.sub);
  res.status(204).end();
}));

router.patch('/lessons/:lessonId/files/reorder', teacherOnly, asyncHandler(async (req, res) => {
  res.json(await svc.reorderLessonFiles(req.params.lessonId, req.user.sub, req.body));
}));

// ─── Visibility toggles ─────────────────────────────────────────────────────
router.patch('/modules/:moduleId/toggle-hidden', teacherOnly, asyncHandler(async (req, res) => {
  res.json(await svc.toggleModuleHidden(req.params.moduleId, req.user.sub));
}));

router.patch('/lessons/:lessonId/toggle-hidden', teacherOnly, asyncHandler(async (req, res) => {
  res.json(await svc.toggleLessonHidden(req.params.lessonId, req.user.sub));
}));

// ─── Publication workflow ────────────────────────────────────────────────────
router.post('/courses/:courseId/transition', asyncHandler(async (req, res) => {
  res.json(await svc.transitionStatus(req.params.courseId, req.user.sub, req.body.status, req.body.note));
}));

// ─── Enhanced analytics ──────────────────────────────────────────────────────
router.get('/courses/:courseId/analytics/enhanced', teacherOnly, asyncHandler(async (req, res) => {
  res.json(await svc.enhancedAnalytics(req.params.courseId, req.user.sub));
}));

export default router;
