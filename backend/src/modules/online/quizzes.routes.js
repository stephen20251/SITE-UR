import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import {
  courseIdParam,
  quizIdParam,
  createQuizBody,
  updateQuizBody,
  submitQuizBody,
} from './quizzes.schemas.js';
import * as svc from './quizzes.service.js';

// Mounted at /api/online (parent enforces auth + ONLINE system).
const router = Router();

const teacherOnly = requireRole('TEACHER_ONLINE');
const studentOnly = requireRole('STUDENT_ONLINE');

// Student: pending quizzes across all enrolled courses
router.get(
  '/quizzes/my-pending',
  studentOnly,
  asyncHandler(async (req, res) => {
    res.json(await svc.myPendingQuizzes(req.user.sub));
  }),
);

// ─── Course-scoped ───
router.post(
  '/courses/:courseId/quizzes',
  teacherOnly,
  validate({ params: courseIdParam, body: createQuizBody }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await svc.createQuiz(req.params.courseId, req.user.sub, req.body));
  }),
);

// Role-aware list (owner teacher or enrolled student) — access enforced in service.
router.get(
  '/courses/:courseId/quizzes',
  validate({ params: courseIdParam }),
  asyncHandler(async (req, res) => {
    res.json(await svc.listForCourse(req.params.courseId, req.user));
  }),
);

// ─── Quiz-scoped (specific subpaths before '/:quizId') ───
router.get(
  '/quizzes/:quizId/attempts',
  teacherOnly,
  validate({ params: quizIdParam }),
  asyncHandler(async (req, res) => {
    res.json(await svc.quizAttempts(req.params.quizId, req.user.sub));
  }),
);

router.get(
  '/quizzes/:quizId/my-attempts',
  studentOnly,
  validate({ params: quizIdParam }),
  asyncHandler(async (req, res) => {
    res.json(await svc.myAttempts(req.params.quizId, req.user.sub));
  }),
);

router.post(
  '/quizzes/:quizId/submit',
  studentOnly,
  validate({ params: quizIdParam, body: submitQuizBody }),
  asyncHandler(async (req, res) => {
    res.json(await svc.submitQuiz(req.params.quizId, req.user.sub, req.body.answers));
  }),
);

// Role-aware fetch (owner gets answer key, student gets a takeable copy).
router.get(
  '/quizzes/:quizId',
  validate({ params: quizIdParam }),
  asyncHandler(async (req, res) => {
    res.json(await svc.getQuiz(req.params.quizId, req.user));
  }),
);

router.patch(
  '/quizzes/:quizId',
  teacherOnly,
  validate({ params: quizIdParam, body: updateQuizBody }),
  asyncHandler(async (req, res) => {
    res.json(await svc.updateQuiz(req.params.quizId, req.user.sub, req.body));
  }),
);

router.delete(
  '/quizzes/:quizId',
  teacherOnly,
  validate({ params: quizIdParam }),
  asyncHandler(async (req, res) => {
    await svc.deleteQuiz(req.params.quizId, req.user.sub);
    res.status(204).end();
  }),
);

export default router;
