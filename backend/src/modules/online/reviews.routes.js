import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireSystem } from '../../middlewares/auth.js';
import * as svc from './reviews.service.js';

const r = Router();

// Public list of reviews for a course (any ONLINE user).
r.get('/courses/:courseId/reviews', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page ?? 1), 1);
  const limit = Math.min(Number(req.query.limit ?? 20), 50);
  res.json(await svc.listReviews(req.params.courseId, { page, limit }));
}));

// The requesting student's own review (or null).
r.get('/courses/:courseId/reviews/mine', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.myReview(req.user.sub, req.params.courseId));
}));

// Create or update the student's review.
r.put('/courses/:courseId/reviews/mine', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.upsertReview(req.user.sub, req.params.courseId, req.body ?? {}));
}));

r.delete('/courses/:courseId/reviews/mine', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.deleteMyReview(req.user.sub, req.params.courseId));
}));

// Teacher/admin: reply to a review.
r.post('/reviews/:reviewId/reply', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.replyToReview(req.user.sub, req.params.reviewId, req.body?.reply ?? ''));
}));

// Teacher/admin: hide/unhide (moderation).
r.patch('/reviews/:reviewId/hidden', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.setReviewHidden(req.user.sub, req.params.reviewId, req.body?.isHidden));
}));

export default r;
