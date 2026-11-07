import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireSystem } from '../../middlewares/auth.js';
import * as svc from './coupon.service.js';

const r = Router();
const online = requireSystem('ONLINE');

// List coupons the caller can manage (own courses, or all for admin).
r.get('/coupons', online, asyncHandler(async (req, res) => {
  res.json(await svc.listCoupons(req.user.sub, { courseId: req.query.courseId }));
}));

r.post('/coupons', online, asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createCoupon(req.user.sub, req.body ?? {}));
}));

r.patch('/coupons/:id', online, asyncHandler(async (req, res) => {
  res.json(await svc.updateCoupon(req.user.sub, req.params.id, req.body ?? {}));
}));

r.delete('/coupons/:id', online, asyncHandler(async (req, res) => {
  res.json(await svc.deleteCoupon(req.user.sub, req.params.id));
}));

export default r;
