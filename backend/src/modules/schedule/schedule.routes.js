import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as svc from './schedule.service.js';

const r = Router();
r.use(authenticate);

// ─── Periods ─────────────────────────────────────────────────
r.get('/periods', asyncHandler(async (req, res) => {
  res.json(await svc.listPeriods(req.user, req.query.mentionId));
}));

r.post('/periods', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createPeriod(req.user, req.body));
}));

r.get('/periods/:id', asyncHandler(async (req, res) => {
  res.json(await svc.getPeriod(req.user, req.params.id));
}));

r.patch('/periods/:id/status', asyncHandler(async (req, res) => {
  res.json(await svc.updatePeriodStatus(req.user, req.params.id, req.body.status));
}));

r.post('/periods/:id/validate', asyncHandler(async (req, res) => {
  res.json(await svc.validatePeriod(req.user, req.params.id, req.body.notes));
}));

r.post('/periods/:id/publish', asyncHandler(async (req, res) => {
  res.json(await svc.publishPeriod(req.user, req.params.id));
}));

r.get('/periods/:id/view', asyncHandler(async (req, res) => {
  res.json(await svc.getPeriodView(req.params.id));
}));

r.get('/periods/:id/resources', asyncHandler(async (req, res) => {
  const period = await svc.getPeriod(req.user, req.params.id);
  res.json(await svc.getBuilderResources(req.user, period.mentionId));
}));

r.get('/periods/:id/conflicts', asyncHandler(async (req, res) => {
  res.json(await svc.checkConflicts(req.user, req.params.id, req.query));
}));

r.post('/periods/:id/remind', asyncHandler(async (req, res) => {
  res.json(await svc.remindPendingTeachers(req.user, req.params.id));
}));

// ─── Envoi aux enseignants / validation par l'enseignant ─────
r.post('/periods/:id/send-to-teachers', asyncHandler(async (req, res) => {
  res.json(await svc.sendToTeachers(req.user, req.params.id));
}));

r.get('/periods/:id/my-slots', asyncHandler(async (req, res) => {
  res.json(await svc.myPeriodSlots(req.user, req.params.id));
}));

r.post('/periods/:id/respond', asyncHandler(async (req, res) => {
  res.json(await svc.respondToSchedule(req.user, req.params.id, req.body));
}));

// ─── Availability ─────────────────────────────────────────────
r.get('/periods/:id/my-availability', asyncHandler(async (req, res) => {
  res.json(await svc.getMyAvailability(req.user, req.params.id));
}));

r.post('/periods/:id/my-availability', asyncHandler(async (req, res) => {
  res.json(await svc.submitAvailability(req.user, req.params.id, req.body.slots));
}));

r.post('/periods/:id/my-preference', asyncHandler(async (req, res) => {
  res.json(await svc.submitPreference(req.user, req.params.id, req.body));
}));

// ─── Slots ────────────────────────────────────────────────────
r.post('/periods/:id/slots', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.addSlot(req.user, req.params.id, req.body));
}));

r.put('/slots/:slotId', asyncHandler(async (req, res) => {
  res.json(await svc.updateSlot(req.user, req.params.slotId, req.body));
}));

r.delete('/slots/:slotId', asyncHandler(async (req, res) => {
  await svc.deleteSlot(req.user, req.params.slotId);
  res.status(204).end();
}));

// ─── My schedule (teacher / student) ─────────────────────────
r.get('/my-schedule', asyncHandler(async (req, res) => {
  res.json(await svc.getMySchedule(req.user));
}));

export default r;
