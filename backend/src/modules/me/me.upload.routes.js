import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { authenticate } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { prisma } from '../../database/prisma.js';

const r = Router();
r.use(authenticate);

const UPLOADS_DIR = path.resolve('uploads');

function diskStorage(subfolder) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOADS_DIR, subfolder);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${req.user.sub}-${Date.now()}${ext}`);
    },
  });
}

const avatarUpload    = multer({ storage: diskStorage('avatars'),    limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFilter });
const signatureUpload = multer({ storage: diskStorage('signatures'), limits: { fileSize: 3 * 1024 * 1024 }, fileFilter: imageFilter });

function imageFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Type de fichier non supporté. Utilisez JPEG, PNG ou WebP.'));
}

// ── Avatar ────────────────────────────────────────────────────────────────────

r.post('/avatar', avatarUpload.single('avatar'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

  // Delete old avatar file if stored locally
  const current = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { avatarUrl: true } });
  if (current?.avatarUrl?.startsWith('/uploads/')) {
    const oldPath = path.join(UPLOADS_DIR, '..', current.avatarUrl);
    fs.unlink(oldPath, () => {});
  }

  const url = `/uploads/avatars/${req.file.filename}`;
  const user = await prisma.user.update({
    where: { id: req.user.sub },
    data:  { avatarUrl: url },
    select: { id: true, avatarUrl: true },
  });
  res.json(user);
}));

r.delete('/avatar', asyncHandler(async (req, res) => {
  const current = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { avatarUrl: true } });
  if (current?.avatarUrl?.startsWith('/uploads/')) {
    const filePath = path.join(UPLOADS_DIR, '..', current.avatarUrl);
    fs.unlink(filePath, () => {});
  }
  const user = await prisma.user.update({
    where: { id: req.user.sub },
    data:  { avatarUrl: null },
    select: { id: true, avatarUrl: true },
  });
  res.json(user);
}));

// ── Signature ─────────────────────────────────────────────────────────────────

r.post('/signature', signatureUpload.single('signature'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

  const current = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { signatureUrl: true } });
  if (current?.signatureUrl?.startsWith('/uploads/')) {
    const oldPath = path.join(UPLOADS_DIR, '..', current.signatureUrl);
    fs.unlink(oldPath, () => {});
  }

  const url = `/uploads/signatures/${req.file.filename}`;
  const user = await prisma.user.update({
    where: { id: req.user.sub },
    data:  { signatureUrl: url },
    select: { id: true, signatureUrl: true },
  });
  res.json(user);
}));

r.delete('/signature', asyncHandler(async (req, res) => {
  const current = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { signatureUrl: true } });
  if (current?.signatureUrl?.startsWith('/uploads/')) {
    fs.unlink(path.join(UPLOADS_DIR, '..', current.signatureUrl), () => {});
  }
  const user = await prisma.user.update({
    where: { id: req.user.sub },
    data:  { signatureUrl: null },
    select: { id: true, signatureUrl: true },
  });
  res.json(user);
}));

export default r;
