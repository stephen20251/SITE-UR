import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireSystem } from '../../middlewares/auth.js';
import * as svc from './assignments.service.js';

// Fichiers d'exercices joints aux devoirs (énoncés, données…)
const attachDir = path.resolve('uploads/assignments');
if (!fs.existsSync(attachDir)) fs.mkdirSync(attachDir, { recursive: true });
const attachUpload = multer({
  storage: multer.diskStorage({
    destination: attachDir,
    filename: (req, file, cb) => cb(null, `asg-${req.params.assignmentId}-${Date.now()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const r = Router();

// Student: pending assignments across all enrolled courses
r.get('/assignments/my-pending', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.myPendingAssignments(req.user.sub));
}));

// List assignments for a course
r.get('/courses/:courseId/assignments', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.listForCourse(req.params.courseId, req.user));
}));

// Teacher: create assignment
r.post('/courses/:courseId/assignments', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createAssignment(req.params.courseId, req.user.sub, req.body));
}));

// Teacher: update assignment
r.patch('/assignments/:assignmentId', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.updateAssignment(req.params.assignmentId, req.user.sub, req.body));
}));

// Teacher: joindre / retirer un fichier d'exercice
r.post('/assignments/:assignmentId/attachments', requireSystem('ONLINE'), attachUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });
  const file = {
    name: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
    url: `/uploads/assignments/${req.file.filename}`,
    mimeType: req.file.mimetype,
    size: req.file.size,
  };
  res.status(201).json(await svc.addAttachment(req.params.assignmentId, req.user.sub, file));
}));
r.delete('/assignments/:assignmentId/attachments', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.removeAttachment(req.params.assignmentId, req.user.sub, String(req.query.url ?? '')));
}));

// Teacher: delete assignment
r.delete('/assignments/:assignmentId', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  await svc.deleteAssignment(req.params.assignmentId, req.user.sub);
  res.json({ ok: true });
}));

// Teacher: list submissions
r.get('/assignments/:assignmentId/submissions', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.listSubmissions(req.params.assignmentId, req.user.sub));
}));

// Teacher: grade a submission
r.patch('/submissions/:submissionId/grade', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.gradeSubmission(req.params.submissionId, req.user.sub, req.body));
}));

// Student: submit assignment
r.post('/assignments/:assignmentId/submit', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.submitAssignment(req.params.assignmentId, req.user.sub, req.body));
}));

// ─── Peer review ──────────────────────────────────────────────────────────────

// Student: anonymous peer submissions awaiting my review
r.get('/assignments/:assignmentId/peer-queue', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.peerQueue(req.params.assignmentId, req.user.sub));
}));

// Student: review a peer submission (score + comment)
r.post('/submissions/:submissionId/peer-review', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.submitPeerReview(req.params.submissionId, req.user.sub, req.body ?? {}));
}));

// Student: peer feedback received on my own submission
r.get('/assignments/:assignmentId/peer-feedback', requireSystem('ONLINE'), asyncHandler(async (req, res) => {
  res.json(await svc.myPeerFeedback(req.params.assignmentId, req.user.sub));
}));

export default r;
