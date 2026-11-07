import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const r = Router();
r.use(authenticate);

// ── List templates ─────────────────────────────────────────────────────────────
r.get('/', asyncHandler(async (req, res) => {
  const { type } = req.query;
  const where = type ? { type } : {};
  const templates = await prisma.documentTemplate.findMany({
    where,
    select: {
      id: true, name: true, type: true, description: true,
      isDefault: true, version: true, canvasWidth: true, canvasHeight: true,
      createdAt: true, updatedAt: true,
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
  });
  res.json(templates);
}));

// ── Get single template (with full canvasData) ─────────────────────────────────
r.get('/:id', asyncHandler(async (req, res) => {
  const t = await prisma.documentTemplate.findUnique({ where: { id: req.params.id } });
  if (!t) throw new HttpError(404, 'Modèle introuvable');
  res.json(t);
}));

// ── Create template ────────────────────────────────────────────────────────────
r.post('/', asyncHandler(async (req, res) => {
  const { name, type, description, canvasData, canvasWidth, canvasHeight, isDefault } = req.body;
  if (!name) throw new HttpError(400, 'Le nom est requis');
  const t = await prisma.documentTemplate.create({
    data: {
      name, type: type ?? 'STUDENT_CARD', description,
      canvasData: canvasData ?? [],
      canvasWidth:  canvasWidth  ?? 638,
      canvasHeight: canvasHeight ?? 408,
      isDefault: !!isDefault,
      createdById: req.user.id,
    },
  });
  res.status(201).json(t);
}));

// ── Update template (save canvas) ──────────────────────────────────────────────
r.put('/:id', asyncHandler(async (req, res) => {
  const { name, description, canvasData, canvasWidth, canvasHeight, isDefault } = req.body;
  const existing = await prisma.documentTemplate.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new HttpError(404, 'Modèle introuvable');
  const t = await prisma.documentTemplate.update({
    where: { id: req.params.id },
    data: {
      ...(name        !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(canvasData  !== undefined && { canvasData }),
      ...(canvasWidth !== undefined && { canvasWidth }),
      ...(canvasHeight !== undefined && { canvasHeight }),
      ...(isDefault   !== undefined && { isDefault }),
      version: { increment: 1 },
    },
  });
  res.json(t);
}));

// ── Duplicate template ─────────────────────────────────────────────────────────
r.post('/:id/duplicate', asyncHandler(async (req, res) => {
  const src = await prisma.documentTemplate.findUnique({ where: { id: req.params.id } });
  if (!src) throw new HttpError(404, 'Modèle introuvable');
  const copy = await prisma.documentTemplate.create({
    data: {
      name: `${src.name} (copie)`, type: src.type, description: src.description,
      canvasData: src.canvasData, canvasWidth: src.canvasWidth, canvasHeight: src.canvasHeight,
      createdById: req.user.id,
    },
  });
  res.status(201).json(copy);
}));

// ── Delete template ────────────────────────────────────────────────────────────
r.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await prisma.documentTemplate.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new HttpError(404, 'Modèle introuvable');
  await prisma.documentTemplate.delete({ where: { id: req.params.id } });
  res.json({ deleted: true });
}));

export default r;
