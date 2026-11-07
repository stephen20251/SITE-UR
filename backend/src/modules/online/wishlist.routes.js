import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireSystem } from '../../middlewares/auth.js';
import * as svc from './wishlist.service.js';

const r = Router();
const online = requireSystem('ONLINE');

r.get('/wishlist', online, asyncHandler(async (req, res) => {
  res.json(await svc.listWishlist(req.user.sub));
}));

r.get('/wishlist/ids', online, asyncHandler(async (req, res) => {
  res.json(await svc.wishlistIds(req.user.sub));
}));

r.post('/wishlist/:courseId/toggle', online, asyncHandler(async (req, res) => {
  res.json(await svc.toggleWishlist(req.user.sub, req.params.courseId));
}));

export default r;
