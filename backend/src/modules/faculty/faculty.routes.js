// ─────────────────────────────────────────────────────────────────────────────
// Corps enseignant : dossier académique et CV des enseignants.
//   POST   /api/faculty/me/cv    → l'enseignant dépose ou remplace son CV (PDF)
//   DELETE /api/faculty/me/cv    → l'enseignant retire son CV
//   GET    /api/faculty/me/cv    → l'enseignant consulte son propre CV
//   GET    /api/faculty          → professeurs et docteurs (fiche + CV déposé)
//   GET    /api/faculty/:id/cv   → CV d'un enseignant de la liste
// Consultation réservée aux étudiants inscrits, à leurs parents et au Super admin.
// Les CV sont hors de /uploads (public) : ils ne sortent que par ces routes.
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { prisma } from '../../database/prisma.js';
import { authenticate } from '../../middlewares/auth.js';
import { requireSystemRole } from '../../middlewares/rbac.js';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';
import { CURSUS_KINDS } from '../cursus/cursus.access.js';
import { ensureProfile } from '../me/ensure-profile.js';

const r = Router();
r.use(authenticate);

const CV_DIR = path.resolve('private-uploads', 'teacher-cv');
const MAX_CV_SIZE = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { fs.mkdirSync(CV_DIR, { recursive: true }); cb(null, CV_DIR); },
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}.pdf`),
  }),
  limits: { fileSize: MAX_CV_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new HttpError(400, 'Le CV doit être un fichier PDF'));
  },
});

// path.basename : le nom stocké ne peut pas sortir du dossier des CV.
const cvFile = (cvPath) => path.join(CV_DIR, path.basename(cvPath));
const removeCv = (cvPath) => { if (cvPath) fs.unlink(cvFile(cvPath), () => {}); };

// Le type annoncé par le navigateur ne suffit pas : on vérifie la signature du fichier.
function isPdfFile(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(5);
    fs.readSync(fd, head, 0, 5, 0);
    return head.toString('latin1') === '%PDF-';
  } finally {
    fs.closeSync(fd);
  }
}

function sendCv(res, profile) {
  const file = cvFile(profile.cvPath);
  if (!fs.existsSync(file)) throw new HttpError(404, 'CV introuvable');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(profile.cvFileName ?? 'cv.pdf')}`);
  res.sendFile(file);
}

// Étudiant inscrit (fiche active rattachée à une promotion) ou parent d'un tel étudiant.
const ENROLLED = { status: 'ACTIVE', promotionId: { not: null } };
async function canViewFaculty(user) {
  if (user.systemRole === 'SUPER_ADMIN') return true;
  if (user.systemRole === 'STUDENT') {
    return (await prisma.studentProfile.count({ where: { userId: user.sub, ...ENROLLED } })) > 0;
  }
  if (user.systemRole === 'PARENT') {
    return (await prisma.parentLink.count({ where: { parent: { userId: user.sub }, student: ENROLLED } })) > 0;
  }
  return false;
}

async function requireFacultyAccess(req, res, next) {
  try {
    if (!(await canViewFaculty(req.user))) {
      throw new HttpError(403, 'Le corps enseignant est réservé aux étudiants inscrits et à leurs parents.');
    }
    next();
  } catch (e) {
    next(e);
  }
}

const LISTED = {
  academicTitle: { not: null },
  cvPath: { not: null },
  user: { isActive: true },
};

// ── Espace de l'enseignant ────────────────────────────────────────────────────
const teacherOnly = requireSystemRole('TEACHER');

r.post('/me/cv', teacherOnly, upload.single('cv'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Aucun fichier fourni');
  if (!isPdfFile(req.file.path)) {
    fs.unlink(req.file.path, () => {});
    throw new HttpError(400, "Ce fichier n'est pas un PDF valide");
  }
  await ensureProfile(req.user.sub, req.user.systemRole);
  const current = await prisma.teacherProfile.findUnique({ where: { userId: req.user.sub }, select: { cvPath: true } });
  const updated = await prisma.teacherProfile.update({
    where: { userId: req.user.sub },
    // multer décode le nom du fichier en latin1 : on rétablit les accents.
    data: { cvPath: req.file.filename, cvFileName: Buffer.from(req.file.originalname, 'latin1').toString('utf8').slice(0, 200), cvUpdatedAt: new Date() },
    select: { cvFileName: true, cvUpdatedAt: true },
  });
  removeCv(current?.cvPath); // l'ancien CV est remplacé
  res.status(201).json(updated);
}));

r.delete('/me/cv', teacherOnly, asyncHandler(async (req, res) => {
  const current = await prisma.teacherProfile.findUnique({ where: { userId: req.user.sub }, select: { cvPath: true } });
  if (!current) throw new HttpError(404, 'Fiche enseignant introuvable');
  await prisma.teacherProfile.update({
    where: { userId: req.user.sub },
    data: { cvPath: null, cvFileName: null, cvUpdatedAt: null },
  });
  removeCv(current.cvPath);
  res.json({ ok: true });
}));

r.get('/me/cv', teacherOnly, asyncHandler(async (req, res) => {
  const profile = await prisma.teacherProfile.findUnique({ where: { userId: req.user.sub }, select: { cvPath: true, cvFileName: true } });
  if (!profile?.cvPath) throw new HttpError(404, 'Aucun CV déposé');
  sendCv(res, profile);
}));

// ── Consultation ──────────────────────────────────────────────────────────────
r.get('/', requireFacultyAccess, asyncHandler(async (req, res) => {
  const profiles = await prisma.teacherProfile.findMany({
    where: LISTED,
    select: {
      id: true, academicTitle: true, highestDegree: true, yearsExperience: true,
      specialization: true, bio: true, cvUpdatedAt: true,
      mention: { select: { id: true, name: true } },
      user: {
        select: {
          firstName: true, lastName: true, avatarUrl: true,
          onlineCourses: {
            where: { status: 'PUBLISHED', courseKind: { in: CURSUS_KINDS } },
            select: { id: true, title: true },
            orderBy: { title: 'asc' },
            take: 6,
          },
        },
      },
    },
  });
  // Les professeurs d'abord, puis les docteurs ; ordre alphabétique dans chaque groupe.
  const rank = { PROFESSEUR: 0, DOCTEUR: 1 };
  profiles.sort((a, b) => rank[a.academicTitle] - rank[b.academicTitle]
    || a.user.lastName.localeCompare(b.user.lastName, 'fr'));
  res.json(profiles.map(({ user, ...p }) => ({
    ...p,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    courses: user.onlineCourses,
  })));
}));

r.get('/:id/cv', requireFacultyAccess, asyncHandler(async (req, res) => {
  const profile = await prisma.teacherProfile.findFirst({
    where: { id: req.params.id, ...LISTED },
    select: { cvPath: true, cvFileName: true },
  });
  if (!profile) throw new HttpError(404, 'CV introuvable');
  sendCv(res, profile);
}));

export default r;
