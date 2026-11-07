import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParam, listQuery } from './notifications.schemas.js';
import * as svc from './notifications.service.js';

// Mounted at /api/notifications — any authenticated user (system-agnostic).
const router = Router();
router.use(authenticate);

router.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  res.json(await svc.list(req.user.sub, req.query));
}));

router.get('/unread-count', asyncHandler(async (req, res) => {
  res.json(await svc.unreadCount(req.user.sub));
}));

router.post('/:id/read', validate({ params: idParam }), asyncHandler(async (req, res) => {
  res.json(await svc.markRead(req.user.sub, req.params.id));
}));

router.post('/read-all', asyncHandler(async (req, res) => {
  res.json(await svc.markAll(req.user.sub));
}));

export default router;
