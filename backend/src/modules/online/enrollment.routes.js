import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import {
  courseIdParam,
  lessonIdParam,
  certCodeParam,
  listEnrollQuery,
  progressBody,
} from './enrollment.schemas.js';
import * as svc from './enrollment.service.js';

// Mounted at /api/online (parent enforces auth + ONLINE system).
// Student-only, per-route guarded (shares the '/' mount with sibling routers).
const router = Router();

const studentOnly = requireRole('STUDENT_ONLINE');

// ─── Enrollment ───
router.post(
  '/courses/:courseId/enroll',
  studentOnly,
  validate({ params: courseIdParam }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await svc.enroll(req.user.sub, req.params.courseId, req.user));
  }),
);

router.get(
  '/enrollments',
  studentOnly,
  validate({ query: listEnrollQuery }),
  asyncHandler(async (req, res) => {
    res.json(await svc.myEnrollments(req.user.sub, req.query));
  }),
);

router.get(
  '/enrollments/:courseId',
  studentOnly,
  validate({ params: courseIdParam }),
  asyncHandler(async (req, res) => {
    res.json(await svc.myEnrollmentDetail(req.user.sub, req.params.courseId));
  }),
);

// ─── Progress ───
router.post(
  '/lessons/:lessonId/progress',
  studentOnly,
  validate({ params: lessonIdParam, body: progressBody }),
  asyncHandler(async (req, res) => {
    res.json(await svc.updateLessonProgress(req.user.sub, req.params.lessonId, req.body));
  }),
);

// ─── Certificates ───
router.get(
  '/certificates',
  studentOnly,
  asyncHandler(async (req, res) => {
    res.json(await svc.myCertificates(req.user.sub));
  }),
);

// Verification is open to any authenticated online user (teacher or student).
router.get(
  '/certificates/:code/verify',
  validate({ params: certCodeParam }),
  asyncHandler(async (req, res) => {
    res.json(await svc.verifyCertificate(req.params.code));
  }),
);

export default router;
