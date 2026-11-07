import { Router } from 'express';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { requireAnyPermission } from '../../middlewares/rbac.js';
import { prisma } from '../../database/prisma.js';
import * as svc from './cursus.service.js';
import { reviewQueue, assertCanReview, transitionCourseStatus } from '../online/course-review.service.js';
import { getCourseDetail } from '../online/courses.service.js';

// Mounted at /api/cursus
const r = Router();
r.use(authenticate);

const student = requireRole('STUDENT');
const parent = requireRole('PARENT');
const teacher = requireRole('TEACHER_ONLINE'); // TEACHER (université) inclus via alias
const tuition = requireAnyPermission('MANAGE_TUITION');
// Guichet : la comptabilité et le secrétariat (paiement physique au bureau) encaissent les espèces
const cashDesk = requireAnyPermission('MANAGE_TUITION', 'RECORD_TUITION_CASH');
const curriculum = requireAnyPermission('MANAGE_CURRICULUM');
const supervise = requireAnyPermission('SUPERVISE_COURSES', 'MANAGE_CURRICULUM', 'TRACK_COURSES');
const attendance = requireAnyPermission('TAKE_ATTENDANCE');
const tracking = requireAnyPermission('TRACK_COURSES');
const passage = requireAnyPermission('VALIDATE_LEVEL_PASSAGE');

// ─── Référentiel (studio enseignant) ─────────────────────────────────────────
r.get('/mentions', asyncHandler(async (req, res) => {
  res.json(await prisma.mention.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } }));
}));

// ─── Validation des cours (Super Admin, Responsable de la mention) ───────────
const approver = requireAnyPermission('APPROVE_COURSE');
r.get('/course-reviews', approver, asyncHandler(async (req, res) => {
  res.json(await reviewQueue(req.user.sub, req.query));
}));
r.get('/course-reviews/:id', approver, asyncHandler(async (req, res) => {
  await assertCanReview(req.user.sub, req.params.id);
  res.json(await getCourseDetail(req.params.id, req.user, { asReviewer: true }));
}));
r.post('/course-reviews/:id/decision', approver, asyncHandler(async (req, res) => {
  const { decision, note } = req.body;
  if (!['publish', 'reject'].includes(decision)) throw new HttpError(400, 'Décision invalide');
  res.json(await transitionCourseStatus(req.params.id, req.user.sub, decision === 'publish' ? 'PUBLISHED' : 'DRAFT', note));
}));

// ─── Étudiant ────────────────────────────────────────────────────────────────
r.get('/me', student, asyncHandler(async (req, res) => {
  res.json(await svc.myCursus(req.user));
}));
r.post('/me/tuition', student, asyncHandler(async (req, res) => {
  res.status(201).json(await svc.declareTuition(req.user, req.body));
}));

// ─── Parent ──────────────────────────────────────────────────────────────────
r.get('/parent/children', parent, asyncHandler(async (req, res) => {
  res.json(await svc.parentChildren(req.user));
}));

// ─── Comptabilité : écolage ──────────────────────────────────────────────────
r.get('/tuition', tuition, asyncHandler(async (req, res) => {
  res.json(await svc.listTuition(req.query));
}));
r.get('/tuition/stats', tuition, asyncHandler(async (req, res) => {
  res.json(await svc.tuitionStats());
}));
r.get('/tuition/students', cashDesk, asyncHandler(async (req, res) => {
  res.json(await svc.searchStudentsForTuition(req.query.q ?? ''));
}));
r.get('/tuition/by-month', tuition, asyncHandler(async (req, res) => {
  res.json(await svc.tuitionByMonth(req.query));
}));
r.get('/tuition/student/:studentId', cashDesk, asyncHandler(async (req, res) => {
  res.json(await svc.studentTuitionDetail(req.params.studentId));
}));
r.post('/tuition/cash', cashDesk, asyncHandler(async (req, res) => {
  res.status(201).json(await svc.recordCashTuition(req.user.sub, req.body));
}));
r.post('/tuition/:id/validate', tuition, asyncHandler(async (req, res) => {
  res.json(await svc.validateTuition(req.user.sub, req.params.id));
}));
r.post('/tuition/:id/refuse', tuition, asyncHandler(async (req, res) => {
  res.json(await svc.refuseTuition(req.user.sub, req.params.id, req.body.reason));
}));
r.get('/tuition/settings', tuition, asyncHandler(async (req, res) => {
  res.json(await svc.tuitionSettings());
}));
r.put('/tuition/settings', tuition, asyncHandler(async (req, res) => {
  res.json(await svc.upsertTuitionSetting(req.body));
}));
r.get('/earnings', tuition, asyncHandler(async (req, res) => {
  res.json(await svc.earningsOverview());
}));

// ─── Responsable : plan du cursus, supervision, passage ──────────────────────
r.get('/curriculum/options', curriculum, asyncHandler(async (req, res) => {
  res.json(await svc.curriculumOptions(req, req.query.mentionId));
}));
r.get('/curriculum', curriculum, asyncHandler(async (req, res) => {
  res.json(await svc.listCurriculum(req, req.query));
}));
r.post('/curriculum', curriculum, asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createCurriculumEntry(req, req.body));
}));
r.patch('/curriculum/:id', curriculum, asyncHandler(async (req, res) => {
  res.json(await svc.updateCurriculumEntry(req, req.params.id, req.body));
}));
r.delete('/curriculum/:id', curriculum, asyncHandler(async (req, res) => {
  res.json(await svc.deleteCurriculumEntry(req, req.params.id));
}));
r.get('/supervision', supervise, asyncHandler(async (req, res) => {
  res.json(await svc.supervision(req, req.query));
}));
r.get('/passage', passage, asyncHandler(async (req, res) => {
  res.json(await svc.passageCandidates(req, req.query));
}));
r.post('/passage/:studentId', passage, asyncHandler(async (req, res) => {
  res.json(await svc.promoteStudent(req, req.params.studentId, req.body));
}));

// ─── Enseignant : mes cours, syllabus, gains ─────────────────────────────────
r.get('/teacher/courses', teacher, asyncHandler(async (req, res) => {
  res.json(await svc.teacherCourses(req.user));
}));
r.get('/teacher/earnings', teacher, asyncHandler(async (req, res) => {
  res.json(await svc.myEarnings(req.user));
}));
r.get('/courses/:courseId/syllabus', asyncHandler(async (req, res) => {
  res.json(await svc.listSyllabus(req.params.courseId));
}));
r.post('/courses/:courseId/syllabus', teacher, asyncHandler(async (req, res) => {
  res.status(201).json(await svc.addSyllabusItem(req.user, req.params.courseId, req.body));
}));
r.put('/courses/:courseId/syllabus/reorder', teacher, asyncHandler(async (req, res) => {
  res.json(await svc.reorderSyllabus(req.user, req.params.courseId, req.body.ids));
}));
r.patch('/syllabus/:id', teacher, asyncHandler(async (req, res) => {
  res.json(await svc.updateSyllabusItem(req.user, req.params.id, req.body));
}));
r.delete('/syllabus/:id', teacher, asyncHandler(async (req, res) => {
  res.json(await svc.deleteSyllabusItem(req.user, req.params.id));
}));

// ─── Secrétariat : syllabus coché, appel, séances du jour ────────────────────
r.post('/syllabus/:id/toggle', tracking, asyncHandler(async (req, res) => {
  res.json(await svc.toggleSyllabusItem(req.user, req.params.id, Boolean(req.body.done)));
}));
r.get('/attendance/promotions', attendance, asyncHandler(async (req, res) => {
  res.json(await svc.attendancePromotions(req));
}));
r.get('/attendance/day', attendance, asyncHandler(async (req, res) => {
  res.json(await svc.attendanceDay(req.query));
}));
r.post('/attendance', attendance, asyncHandler(async (req, res) => {
  res.json(await svc.saveAttendance(req.user, req.body));
}));
r.get('/sessions/day', supervise, asyncHandler(async (req, res) => {
  res.json(await svc.sessionsDay(req, req.query));
}));
r.post('/sessions', tracking, asyncHandler(async (req, res) => {
  res.json(await svc.saveSession(req.user, req.body));
}));

export default r;
