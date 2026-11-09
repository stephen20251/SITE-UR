import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middlewares/auth.js';
import * as svc from './lms-admin.service.js';
import { uploadsPath } from '../../config/paths.js';

const router = Router();

// Apply auth to all LMS admin routes (SUPER_ADMIN only — no system restriction)
router.use(authenticate);

// Multer setup for media uploads
const uploadDir = uploadsPath('lms-media');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

function requireSuperAdmin(req, res, next) {
  if (req.user.systemRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super Admin only' });
  }
  next();
}

router.use(requireSuperAdmin);

// ── Settings ──────────────────────────────────────────────────────────────────
router.get('/settings', asyncHandler(async (req, res) => {
  res.json(await svc.getSettings());
}));

router.put('/settings', asyncHandler(async (req, res) => {
  res.json(await svc.updateSettings(req.body));
}));

// Upload logo → persist URL in settings
router.post('/upload-logo', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new Error('No file');
  const url = `/uploads/lms-media/${req.file.filename}`;
  await svc.updateSettings({ logoUrl: url });
  res.json({ url });
}));

// Upload banner image → persist URL in settings
router.post('/upload-banner', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new Error('No file');
  const url = `/uploads/lms-media/${req.file.filename}`;
  await svc.updateSettings({ bannerUrl: url });
  res.json({ url });
}));

// ── Navigation ─────────────────────────────────────────────────────────────────
router.get('/nav', asyncHandler(async (req, res) => {
  res.json(await svc.getNav());
}));

router.post('/nav', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createNavItem(req.body));
}));

router.put('/nav/reorder', asyncHandler(async (req, res) => {
  res.json(await svc.reorderNav(req.body));
}));

router.put('/nav/:id', asyncHandler(async (req, res) => {
  res.json(await svc.updateNavItem(req.params.id, req.body));
}));

router.delete('/nav/:id', asyncHandler(async (req, res) => {
  await svc.deleteNavItem(req.params.id);
  res.json({ ok: true });
}));

// ── Homepage sections ─────────────────────────────────────────────────────────
router.get('/home-sections', asyncHandler(async (req, res) => {
  res.json(await svc.getHomeSections());
}));

router.put('/home-sections/reorder', asyncHandler(async (req, res) => {
  res.json(await svc.reorderHomeSections(req.body));
}));

router.put('/home-sections/:id', asyncHandler(async (req, res) => {
  res.json(await svc.updateHomeSection(req.params.id, req.body));
}));

// ── Categories ────────────────────────────────────────────────────────────────
router.get('/categories', asyncHandler(async (req, res) => {
  res.json(await svc.getCategories());
}));

router.post('/categories', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createCategory(req.body));
}));

router.put('/categories/:id', asyncHandler(async (req, res) => {
  res.json(await svc.updateCategory(req.params.id, req.body));
}));

router.delete('/categories/:id', asyncHandler(async (req, res) => {
  await svc.deleteCategory(req.params.id);
  res.json({ ok: true });
}));

// ── Courses (Super Admin) ─────────────────────────────────────────────────────
router.get('/courses', asyncHandler(async (req, res) => {
  const { page, limit, q, status, teacherId, categoryId } = req.query;
  res.json(await svc.adminListCourses({
    page: Number(page) || 1,
    limit: Math.min(50, Number(limit) || 20),
    q: q?.toString(),
    status: status?.toString(),
    teacherId: teacherId?.toString(),
    categoryId: categoryId?.toString(),
  }));
}));

router.post('/courses', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.adminCreateCourse(req.body));
}));

router.put('/courses/:id', asyncHandler(async (req, res) => {
  res.json(await svc.adminUpdateCourse(req.params.id, req.body));
}));

router.delete('/courses/:id', asyncHandler(async (req, res) => {
  await svc.adminDeleteCourse(req.params.id);
  res.json({ ok: true });
}));

router.post('/courses/:id/duplicate', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.adminDuplicateCourse(req.params.id));
}));

router.put('/courses/:id/transfer', asyncHandler(async (req, res) => {
  res.json(await svc.adminTransferCourse(req.params.id, req.body.teacherId));
}));

// ── Teachers ──────────────────────────────────────────────────────────────────
router.get('/teachers', asyncHandler(async (req, res) => {
  const { page, limit, q } = req.query;
  res.json(await svc.adminListTeachers({
    page: Number(page) || 1,
    limit: Math.min(50, Number(limit) || 20),
    q: q?.toString(),
  }));
}));

router.put('/teachers/:id', asyncHandler(async (req, res) => {
  res.json(await svc.adminUpdateTeacher(req.params.id, req.body));
}));

// ── Students ──────────────────────────────────────────────────────────────────
router.get('/students', asyncHandler(async (req, res) => {
  const { page, limit, q } = req.query;
  res.json(await svc.adminListStudents({
    page: Number(page) || 1,
    limit: Math.min(50, Number(limit) || 20),
    q: q?.toString(),
  }));
}));

// ── Media library ─────────────────────────────────────────────────────────────
router.get('/media', asyncHandler(async (req, res) => {
  const { page, limit, q, type } = req.query;
  res.json(await svc.listMedia({
    page: Number(page) || 1,
    limit: Math.min(100, Number(limit) || 24),
    q: q?.toString(),
    type: type?.toString(),
  }));
}));

router.post('/media/upload', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new Error('No file uploaded');
  const mime = req.file.mimetype;
  let type = 'DOCUMENT';
  if (mime.startsWith('image/')) type = 'IMAGE';
  else if (mime.startsWith('video/')) type = 'VIDEO';
  else if (mime.startsWith('audio/')) type = 'AUDIO';
  else if (mime === 'application/pdf') type = 'PDF';
  else if (mime.includes('zip') || mime.includes('rar')) type = 'ZIP';

  const url = `/uploads/lms-media/${req.file.filename}`;
  const media = await svc.createMediaFile({
    name: req.body.name || req.file.originalname,
    originalName: req.file.originalname,
    url,
    type,
    size: req.file.size,
    mimeType: mime,
    uploadedBy: req.user.sub,
  });
  res.status(201).json(media);
}));

router.post('/media/link', asyncHandler(async (req, res) => {
  const { name, url, type } = req.body;
  res.status(201).json(await svc.createMediaFile({
    name, url, type: type || 'LINK',
    uploadedBy: req.user.sub,
  }));
}));

router.put('/media/:id', asyncHandler(async (req, res) => {
  res.json(await svc.updateMediaFile(req.params.id, req.body));
}));

router.delete('/media/:id', asyncHandler(async (req, res) => {
  await svc.deleteMediaFile(req.params.id);
  res.json({ ok: true });
}));

// ── Testimonials ──────────────────────────────────────────────────────────────
router.get('/testimonials', asyncHandler(async (req, res) => {
  res.json(await svc.listTestimonials());
}));

router.post('/testimonials', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createTestimonial(req.body));
}));

router.put('/testimonials/:id', asyncHandler(async (req, res) => {
  res.json(await svc.updateTestimonial(req.params.id, req.body));
}));

router.delete('/testimonials/:id', asyncHandler(async (req, res) => {
  await svc.deleteTestimonial(req.params.id);
  res.json({ ok: true });
}));

// ── FAQ ───────────────────────────────────────────────────────────────────────
router.get('/faq', asyncHandler(async (req, res) => {
  res.json(await svc.listFaq());
}));

router.post('/faq', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createFaqItem(req.body));
}));

router.put('/faq/:id', asyncHandler(async (req, res) => {
  res.json(await svc.updateFaqItem(req.params.id, req.body));
}));

router.delete('/faq/:id', asyncHandler(async (req, res) => {
  await svc.deleteFaqItem(req.params.id);
  res.json({ ok: true });
}));

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard', asyncHandler(async (req, res) => {
  res.json(await svc.adminDashboard());
}));

// ── User Management ───────────────────────────────────────────────────────────
router.get('/users', asyncHandler(async (req, res) => {
  const { page, limit, q, role, status } = req.query;
  res.json(await svc.adminListUsers({
    page: Number(page) || 1,
    limit: Math.min(50, Number(limit) || 20),
    q: q?.toString(),
    role: role?.toString(),
    status: status?.toString(),
  }));
}));

router.post('/users', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.adminCreateUser(req.body));
}));

router.patch('/users/:id', asyncHandler(async (req, res) => {
  res.json(await svc.adminUpdateUser(req.params.id, req.body));
}));

router.post('/users/:id/toggle-active', asyncHandler(async (req, res) => {
  res.json(await svc.adminToggleActive(req.params.id));
}));

router.post('/users/:id/reset-password', asyncHandler(async (req, res) => {
  res.json(await svc.adminResetPassword(req.params.id));
}));

router.delete('/users/:id', asyncHandler(async (req, res) => {
  await svc.adminDeleteUser(req.params.id);
  res.status(204).end();
}));

// Certificates registry
router.get('/certificates', asyncHandler(async (req, res) => {
  res.json(await svc.adminListCertificates({
    page: Math.max(1, Number(req.query.page) || 1),
    limit: Math.min(50, Number(req.query.limit) || 20),
    q: req.query.q?.toString(),
  }));
}));

// Live sessions registry
router.get('/live-sessions', asyncHandler(async (req, res) => {
  res.json(await svc.adminListLiveSessions({
    page: Math.max(1, Number(req.query.page) || 1),
    limit: Math.min(50, Number(req.query.limit) || 20),
    q: req.query.q?.toString(),
  }));
}));

// Announcements registry
router.get('/announcements', asyncHandler(async (req, res) => {
  res.json(await svc.adminListAnnouncements({
    page: Math.max(1, Number(req.query.page) || 1),
    limit: Math.min(50, Number(req.query.limit) || 20),
    q: req.query.q?.toString(),
  }));
}));
router.delete('/announcements/:id', asyncHandler(async (req, res) => {
  res.json(await svc.adminDeleteAnnouncement(req.params.id));
}));

// Reviews moderation
router.get('/reviews', asyncHandler(async (req, res) => {
  const hidden = req.query.hidden === 'true' ? true : req.query.hidden === 'false' ? false : undefined;
  res.json(await svc.adminListReviews({
    page: Math.max(1, Number(req.query.page) || 1),
    limit: Math.min(50, Number(req.query.limit) || 20),
    q: req.query.q?.toString(),
    hidden,
  }));
}));
router.patch('/reviews/:id/hidden', asyncHandler(async (req, res) => {
  res.json(await svc.adminSetReviewHidden(req.params.id, req.body?.isHidden));
}));
router.delete('/reviews/:id', asyncHandler(async (req, res) => {
  res.json(await svc.adminDeleteReview(req.params.id));
}));

// Manually trigger the "come back" reminder emails
router.post('/send-reminders', asyncHandler(async (req, res) => {
  const { sendCourseReminders } = await import('../../jobs/reminders.js');
  res.json(await sendCourseReminders());
}));

// Manually trigger the storage retention cleanup (messages 30j, notifs, etc.)
router.post('/cleanup', asyncHandler(async (req, res) => {
  const { runRetentionCleanup } = await import('../../jobs/cleanup.js');
  res.json(await runRetentionCleanup());
}));

export default router;
