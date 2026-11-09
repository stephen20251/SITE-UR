import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { requireAnyPermission } from '../../middlewares/rbac.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as svc from './inscriptions.service.js';

const r = Router();
// Inscriptions : secrétariat (admissions) et administrateur ; lecture aussi pour les responsables.
r.use(authenticate);
r.use((req, res, next) => (req.method === 'GET'
  ? requireAnyPermission('ENROLL_STUDENT', 'VIEW_ALL_USERS', 'SUPERVISE_COURSES')
  : requireAnyPermission('ENROLL_STUDENT'))(req, res, next));

// GET /api/inscriptions — list enrolled students
r.get('/', asyncHandler(async (req, res) => {
  const { academicYearId, mentionId, promotionId, groupId, status, studyMode, q, page, limit } = req.query;
  res.json(await svc.listStudents({ academicYearId, mentionId, promotionId, groupId, status, studyMode, q, page: Number(page ?? 1), limit: Number(limit ?? 30) }));
}));

// GET /api/inscriptions/stats
r.get('/stats', asyncHandler(async (req, res) => {
  res.json(await svc.getInscriptionStats(req.query.academicYearId));
}));

// GET /api/inscriptions/unenrolled — users not yet enrolled
r.get('/unenrolled', asyncHandler(async (req, res) => {
  res.json(await svc.listUnenrolledUsers({ q: req.query.q }));
}));

// GET /api/inscriptions/:id
r.get('/:id', asyncHandler(async (req, res) => {
  res.json(await svc.getStudentProfile(req.params.id));
}));

// POST /api/inscriptions — create user + enroll
r.post('/', asyncHandler(async (req, res) => {
  const profile = await svc.enrollStudent(req.body);
  res.status(201).json(profile);
}));

// POST /api/inscriptions/existing — enroll existing user
r.post('/existing', asyncHandler(async (req, res) => {
  const profile = await svc.enrollExistingUser(req.body);
  res.status(201).json(profile);
}));

// PATCH /api/inscriptions/:id
r.patch('/:id', asyncHandler(async (req, res) => {
  res.json(await svc.updateEnrollment(req.params.id, req.body));
}));

export default r;
