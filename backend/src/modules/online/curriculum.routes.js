import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import {
  courseIdParam,
  moduleIdParam,
  lessonIdParam,
  createModuleBody,
  updateModuleBody,
  createLessonBody,
  updateLessonBody,
} from './curriculum.schemas.js';
import * as svc from './curriculum.service.js';

// Multer for lesson content uploads
const lessonMediaDir = path.resolve('uploads/lessons');
if (!fs.existsSync(lessonMediaDir)) fs.mkdirSync(lessonMediaDir, { recursive: true });
const lessonUpload = multer({
  storage: multer.diskStorage({
    destination: lessonMediaDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${req.params.lessonId}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

function mimeToLessonType(mime) {
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('audio/')) return 'AUDIO';
  if (mime.startsWith('image/')) return 'IMAGE';
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z')) return 'ZIP';
  return 'DOCUMENT';
}

// Mounted at /api/online (parent enforces auth + ONLINE system).
// NOTE: this router shares the '/' mount with enrollment/quiz routers, so the
// teacher guard is applied per-route (a blanket router.use would 403 students
// before they could fall through to the sibling routers). Ownership is verified
// in the service layer.
const router = Router();

const teacherOnly = requireRole('TEACHER_ONLINE');

// ─── Modules ───
router.post(
  '/courses/:courseId/modules',
  teacherOnly,
  validate({ params: courseIdParam, body: createModuleBody }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await svc.createModule(req.params.courseId, req.user.sub, req.body));
  }),
);

router.patch(
  '/modules/:moduleId',
  teacherOnly,
  validate({ params: moduleIdParam, body: updateModuleBody }),
  asyncHandler(async (req, res) => {
    res.json(await svc.updateModule(req.params.moduleId, req.user.sub, req.body));
  }),
);

router.delete(
  '/modules/:moduleId',
  teacherOnly,
  validate({ params: moduleIdParam }),
  asyncHandler(async (req, res) => {
    await svc.deleteModule(req.params.moduleId, req.user.sub);
    res.status(204).end();
  }),
);

// ─── Lessons ───
router.post(
  '/modules/:moduleId/lessons',
  teacherOnly,
  validate({ params: moduleIdParam, body: createLessonBody }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await svc.createLesson(req.params.moduleId, req.user.sub, req.body));
  }),
);

router.patch(
  '/lessons/:lessonId',
  teacherOnly,
  validate({ params: lessonIdParam, body: updateLessonBody }),
  asyncHandler(async (req, res) => {
    res.json(await svc.updateLesson(req.params.lessonId, req.user.sub, req.body));
  }),
);

router.delete(
  '/lessons/:lessonId',
  teacherOnly,
  validate({ params: lessonIdParam }),
  asyncHandler(async (req, res) => {
    await svc.deleteLesson(req.params.lessonId, req.user.sub);
    res.status(204).end();
  }),
);

// ─── Lesson file upload ───
router.post(
  '/lessons/:lessonId/upload',
  teacherOnly,
  validate({ params: lessonIdParam }),
  lessonUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const url = `/uploads/lessons/${req.file.filename}`;
    const type = mimeToLessonType(req.file.mimetype);
    const lesson = await svc.updateLesson(req.params.lessonId, req.user.sub, { contentUrl: url, type });
    res.json({ url, type, lesson });
  }),
);

// ─── Module reorder ───
router.patch(
  '/courses/:courseId/modules/reorder',
  teacherOnly,
  validate({ params: courseIdParam }),
  asyncHandler(async (req, res) => {
    res.json(await svc.reorderModules(req.params.courseId, req.user.sub, req.body));
  }),
);

// ─── Lesson reorder ───
router.patch(
  '/modules/:moduleId/lessons/reorder',
  teacherOnly,
  validate({ params: moduleIdParam }),
  asyncHandler(async (req, res) => {
    res.json(await svc.reorderLessons(req.params.moduleId, req.user.sub, req.body));
  }),
);

export default router;
