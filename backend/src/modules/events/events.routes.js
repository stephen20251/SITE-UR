// ─────────────────────────────────────────────────────────────────────────────
// Événements de l'université (section « Actualité » de la page d'accueil).
//   GET    /api/events/public        → événements publiés (sans authentification)
//   GET    /api/events               → tous les événements (gestion)
//   POST   /api/events               → créer
//   PATCH  /api/events/:id           → modifier
//   DELETE /api/events/:id           → supprimer
//   POST   /api/events/:id/image     → affiche / photo de l'événement
// Gestion réservée au Super administrateur et au Secrétariat (MANAGE_EVENTS).
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { prisma } from '../../database/prisma.js';
import { authenticate } from '../../middlewares/auth.js';
import { requireAnyPermission } from '../../middlewares/rbac.js';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';

const r = Router();
const UPLOAD_DIR = path.resolve('uploads', 'events');

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); cb(null, UPLOAD_DIR); },
    filename: (req, file, cb) => cb(null, `${req.params.id}-${Date.now()}${path.extname(file.originalname).toLowerCase() || '.jpg'}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, 'Image JPEG, PNG ou WebP uniquement'));
  },
});

const removeFile = (url) => {
  if (url?.startsWith('/uploads/events/')) fs.unlink(path.resolve(url.slice(1)), () => {});
};

// Validation des champs envoyés par le formulaire
function parseInput(b, partial = false) {
  const data = {};
  const str = (v, max) => (v === null || v === undefined ? null : String(v).trim().slice(0, max) || null);
  const date = (v, field) => {
    if (v === null || v === '' || v === undefined) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw new HttpError(400, `Date invalide : ${field}`);
    return d;
  };
  if (!partial || b.title !== undefined) {
    data.title = str(b.title, 160);
    if (!data.title) throw new HttpError(400, 'Le titre est obligatoire');
  }
  if (b.description !== undefined) data.description = str(b.description, 4000);
  if (b.location !== undefined) data.location = str(b.location, 160);
  if (!partial || b.startAt !== undefined) {
    data.startAt = date(b.startAt, 'début');
    if (!data.startAt) throw new HttpError(400, 'La date de l\'événement est obligatoire');
  }
  if (b.endAt !== undefined) data.endAt = date(b.endAt, 'fin');
  if (b.isPublished !== undefined) data.isPublished = Boolean(b.isPublished);
  if (data.startAt && data.endAt && data.endAt < data.startAt) throw new HttpError(400, 'La fin doit être après le début');
  return data;
}

// ── Public ────────────────────────────────────────────────────────────────────
// Événements à venir (les plus proches d'abord), complétés par les plus récents passés.
r.get('/public', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 6, 24);
  const now = new Date();
  const upcoming = await prisma.universityEvent.findMany({
    where: { isPublished: true, OR: [{ startAt: { gte: now } }, { endAt: { gte: now } }] },
    orderBy: { startAt: 'asc' }, take: limit,
  });
  const past = upcoming.length >= limit ? [] : await prisma.universityEvent.findMany({
    where: { isPublished: true, startAt: { lt: now }, OR: [{ endAt: null }, { endAt: { lt: now } }] },
    orderBy: { startAt: 'desc' }, take: limit - upcoming.length,
  });
  res.json([...upcoming, ...past]);
}));

// ── Gestion ───────────────────────────────────────────────────────────────────
const manage = [authenticate, requireAnyPermission('MANAGE_EVENTS')];

r.get('/', ...manage, asyncHandler(async (req, res) => {
  res.json(await prisma.universityEvent.findMany({ orderBy: { startAt: 'desc' } }));
}));

r.post('/', ...manage, asyncHandler(async (req, res) => {
  const ev = await prisma.universityEvent.create({ data: { ...parseInput(req.body ?? {}), createdById: req.user.sub } });
  res.status(201).json(ev);
}));

const findOr404 = async (id) => {
  const ev = await prisma.universityEvent.findUnique({ where: { id } });
  if (!ev) throw new HttpError(404, 'Événement introuvable');
  return ev;
};

r.patch('/:id', ...manage, asyncHandler(async (req, res) => {
  const ev = await findOr404(req.params.id);
  const data = parseInput(req.body ?? {}, true);
  const start = data.startAt ?? ev.startAt;
  const end = data.endAt !== undefined ? data.endAt : ev.endAt;
  if (end && end < start) throw new HttpError(400, 'La fin doit être après le début');
  res.json(await prisma.universityEvent.update({ where: { id: ev.id }, data }));
}));

r.delete('/:id', ...manage, asyncHandler(async (req, res) => {
  const ev = await findOr404(req.params.id);
  await prisma.universityEvent.delete({ where: { id: ev.id } });
  removeFile(ev.imageUrl);
  res.json({ ok: true });
}));

r.post('/:id/image', ...manage, asyncHandler(async (req, res, next) => {
  await findOr404(req.params.id);
  next();
}), upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Aucune image fournie');
  const ev = await prisma.universityEvent.findUnique({ where: { id: req.params.id } });
  removeFile(ev.imageUrl);
  res.json(await prisma.universityEvent.update({ where: { id: ev.id }, data: { imageUrl: `/uploads/events/${req.file.filename}` } }));
}));

r.delete('/:id/image', ...manage, asyncHandler(async (req, res) => {
  const ev = await findOr404(req.params.id);
  removeFile(ev.imageUrl);
  res.json(await prisma.universityEvent.update({ where: { id: ev.id }, data: { imageUrl: null } }));
}));

export default r;
