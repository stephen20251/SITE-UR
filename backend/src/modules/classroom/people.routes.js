import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { ROLES } from './classroom.guards.js';
import {
  userIdParam, listPeopleQuery,
  createStudentBody, updateStudentBody, createTeacherBody, updateTeacherBody,
} from './people.schemas.js';
import * as svc from './people.service.js';

// Mounted at /api/classroom (parent enforces auth + CLASSROOM system).
const router = Router();
const staff = requireRole(...ROLES.MANAGE_STRUCTURE);
const readers = requireRole(...ROLES.TEACH_OR_STAFF);

// ─── Students ───
router.get('/students', readers, validate({ query: listPeopleQuery }), asyncHandler(async (req, res) => {
  res.json(await svc.listStudents(req.query));
}));
router.post('/students', staff, validate({ body: createStudentBody }), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createStudent(req.body));
}));
router.get('/students/:userId', readers, validate({ params: userIdParam }), asyncHandler(async (req, res) => {
  res.json(await svc.getStudent(req.params.userId));
}));
router.patch('/students/:userId', staff, validate({ params: userIdParam, body: updateStudentBody }), asyncHandler(async (req, res) => {
  res.json(await svc.updateStudent(req.params.userId, req.body));
}));

// ─── Teachers ───
router.get('/teachers', readers, validate({ query: listPeopleQuery }), asyncHandler(async (req, res) => {
  res.json(await svc.listTeachers(req.query));
}));
router.post('/teachers', staff, validate({ body: createTeacherBody }), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createTeacher(req.body));
}));
router.get('/teachers/:userId', readers, validate({ params: userIdParam }), asyncHandler(async (req, res) => {
  res.json(await svc.getTeacher(req.params.userId));
}));
router.patch('/teachers/:userId', staff, validate({ params: userIdParam, body: updateTeacherBody }), asyncHandler(async (req, res) => {
  res.json(await svc.updateTeacher(req.params.userId, req.body));
}));

export default router;
