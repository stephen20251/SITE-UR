import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middlewares/auth.js';
import * as svc from './payment.service.js';
import { validateCoupon } from './coupon.service.js';
import { uploadsPath } from '../../config/paths.js';

const router = Router();
router.use(authenticate);

// Multer for screenshot uploads
const uploadDir = uploadsPath('lms-media');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `pay-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ── Student routes ────────────────────────────────────────────────────────────

// GET /online/payments/settings  → mobile money numbers (public for logged-in users)
router.get('/settings', asyncHandler(async (req, res) => {
  res.json(await svc.getMobileMoneySettings());
}));

// GET /online/payments/mine → student's own payments
router.get('/mine', asyncHandler(async (req, res) => {
  res.json(await svc.myPayments(req.user.sub));
}));

// POST /online/payments  → submit payment request
router.post('/', asyncHandler(async (req, res) => {
  const payment = await svc.createPayment({ studentId: req.user.sub, ...req.body });
  res.status(201).json(payment);
}));

// POST /online/payments/upload-screenshot → upload proof image
router.post('/upload-screenshot', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new Error('No file');
  res.json({ url: `/uploads/lms-media/${req.file.filename}` });
}));

// POST /online/payments/preview-coupon → check a code + get the discounted price
router.post('/preview-coupon', asyncHandler(async (req, res) => {
  res.json(await validateCoupon(req.user.sub, req.body.code, req.body.courseId));
}));

// POST /online/payments/:id/request-refund → student asks for a refund (30-day window)
router.post('/:id/request-refund', asyncHandler(async (req, res) => {
  res.json(await svc.requestRefund(req.user.sub, req.params.id, req.body?.reason));
}));

// ── Admin routes ──────────────────────────────────────────────────────────────

function requireAdmin(req, res, next) {
  if (req.user.systemRole !== 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super Admin only' });
  }
  next();
}

// GET /online/payments → admin list
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const { page, limit, status, courseId, q } = req.query;
  res.json(await svc.listPayments({
    page: Number(page) || 1,
    limit: Math.min(50, Number(limit) || 20),
    status: status?.toString(),
    courseId: courseId?.toString(),
    q: q?.toString(),
  }));
}));

// GET /online/payments/stats
router.get('/stats', requireAdmin, asyncHandler(async (req, res) => {
  res.json(await svc.paymentStats());
}));

// GET /online/payments/:id
router.get('/:id', requireAdmin, asyncHandler(async (req, res) => {
  res.json(await svc.getPayment(req.params.id));
}));

// POST /online/payments/:id/validate
router.post('/:id/validate', requireAdmin, asyncHandler(async (req, res) => {
  res.json(await svc.validatePaymentGroup(req.params.id, req.user.sub));
}));

// POST /online/payments/:id/refuse
router.post('/:id/refuse', requireAdmin, asyncHandler(async (req, res) => {
  res.json(await svc.refusePaymentGroup(req.params.id, req.user.sub, req.body.reason));
}));

// POST /online/payments/:id/refund → admin approves a refund request
router.post('/:id/refund', requireAdmin, asyncHandler(async (req, res) => {
  res.json(await svc.approveRefund(req.params.id, req.user.sub));
}));

// POST /online/payments/:id/reject-refund → admin declines a refund request
router.post('/:id/reject-refund', requireAdmin, asyncHandler(async (req, res) => {
  res.json(await svc.rejectRefund(req.params.id, req.user.sub, req.body?.reason));
}));

export default router;
