import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import {
  idParam,
  slugParam,
  createCourseBody,
  updateCourseBody,
  listCoursesQuery,
  listMineQuery,
} from './courses.schemas.js';
import * as svc from './courses.service.js';

// Multer for course media (thumbnail + preview video)
const courseMediaDir = path.resolve('uploads/courses');
if (!fs.existsSync(courseMediaDir)) fs.mkdirSync(courseMediaDir, { recursive: true });
const courseUpload = multer({
  storage: multer.diskStorage({
    destination: courseMediaDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${req.params.id}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB for videos
});

// Mounted at /api/online/courses (parent router already enforces auth + ONLINE system).
const router = Router();

const teacherOnly = requireRole('TEACHER_ONLINE');

// ─── Browse (any online user) ───
router.get(
  '/',
  validate({ query: listCoursesQuery }),
  asyncHandler(async (req, res) => {
    res.json(await svc.listPublished(req.query));
  }),
);

// ─── Teacher catalogue — must precede '/:id' ───
router.get(
  '/mine',
  teacherOnly,
  validate({ query: listMineQuery }),
  asyncHandler(async (req, res) => {
    res.json(await svc.listMine(req.user.sub, req.query));
  }),
);

router.get(
  '/slug/:slug',
  validate({ params: slugParam }),
  asyncHandler(async (req, res) => {
    res.json(await svc.getCourseBySlug(req.params.slug, req.user));
  }),
);

router.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    res.json(await svc.getCourseDetail(req.params.id, req.user));
  }),
);

// ─── Teacher mutations ───
router.post(
  '/',
  teacherOnly,
  validate({ body: createCourseBody }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await svc.createCourse(req.user.sub, req.body));
  }),
);

router.patch(
  '/:id',
  teacherOnly,
  validate({ params: idParam, body: updateCourseBody }),
  asyncHandler(async (req, res) => {
    res.json(await svc.updateCourse(req.params.id, req.user.sub, req.body));
  }),
);

router.delete(
  '/:id',
  teacherOnly,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await svc.deleteCourse(req.params.id, req.user.sub);
    res.status(204).end();
  }),
);

router.post(
  '/:id/publish',
  teacherOnly,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    res.json(await svc.publishCourse(req.params.id, req.user.sub));
  }),
);

router.post(
  '/:id/archive',
  teacherOnly,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    res.json(await svc.archiveCourse(req.params.id, req.user.sub));
  }),
);

router.get(
  '/:id/analytics',
  teacherOnly,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    res.json(await svc.courseAnalytics(req.params.id, req.user.sub));
  }),
);

// ─── File uploads (teacher only) ───

// Teacher: list enrolled students
router.get(
  '/:id/enrollments',
  teacherOnly,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    res.json(await svc.getCourseEnrollments(req.params.id, req.user.sub));
  }),
);

router.post(
  '/:id/upload-thumbnail',
  teacherOnly,
  courseUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const url = `/uploads/courses/${req.file.filename}`;
    const course = await svc.updateCourse(req.params.id, req.user.sub, { thumbnail: url });
    res.json({ url, course });
  }),
);

router.post(
  '/:id/upload-preview',
  teacherOnly,
  courseUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const url = `/uploads/courses/${req.file.filename}`;
    const course = await svc.updateCourse(req.params.id, req.user.sub, { previewVideoUrl: url });
    res.json({ url, course });
  }),
);

export default router;
