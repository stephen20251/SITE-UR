import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { ROLES } from './classroom.guards.js';
import { idParam, createAnnouncementBody } from './announcements.schemas.js';
import * as svc from './announcements.service.js';

// Mounted at /api/classroom/announcements.
const router = Router();

// Any classroom user can read their feed.
router.get('/', asyncHandler(async (req, res) => {
  res.json(await svc.listForUser(req.user));
}));

// Teachers + staff can post (GLOBAL scope further restricted in the service).
router.post('/', requireRole(...ROLES.TEACH_OR_STAFF), validate({ body: createAnnouncementBody }), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.create(req.user, req.body));
}));

router.delete('/:id', requireRole(...ROLES.TEACH_OR_STAFF), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await svc.remove(req.user, req.params.id);
  res.status(204).end();
}));

export default router;
