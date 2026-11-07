import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { createFeeBody, createPaymentBody, updatePaymentBody, idParam } from './finance.schemas.js';
import * as svc from './finance.service.js';

// Mounted at /api/classroom/finance
const router = Router();

const FINANCE_STAFF = requireRole('ADMIN', 'SECRETARY', 'TREASURER');

// ─── Fee structures ───
router.get('/fees', asyncHandler(async (_req, res) => {
  res.json(await svc.listFees());
}));

router.post('/fees', FINANCE_STAFF, validate({ body: createFeeBody }), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createFee(req.body));
}));

router.delete('/fees/:id', FINANCE_STAFF, validate({ params: idParam }), asyncHandler(async (req, res) => {
  await svc.deleteFee(req.params.id);
  res.status(204).end();
}));

// ─── My payments (student / parent) ───
router.get('/my-payments', requireRole('STUDENT_CLASSROOM', 'PARENT'), asyncHandler(async (req, res) => {
  res.json(await svc.myPayments(req.user));
}));

// ─── Admin: all payments ───
router.get('/payments', FINANCE_STAFF, asyncHandler(async (req, res) => {
  const { studentId, status, page, limit } = req.query;
  res.json(await svc.listPayments({
    studentId,
    status,
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 50,
  }));
}));

router.post('/payments', FINANCE_STAFF, validate({ body: createPaymentBody }), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createPayment(req.body));
}));

router.patch('/payments/:id', FINANCE_STAFF, validate({ params: idParam, body: updatePaymentBody }), asyncHandler(async (req, res) => {
  res.json(await svc.updatePayment(req.params.id, req.body));
}));

router.get('/overview', FINANCE_STAFF, asyncHandler(async (_req, res) => {
  res.json(await svc.financeOverview());
}));

export default router;
