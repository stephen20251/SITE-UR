import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';
import { prisma } from '../../database/prisma.js';
import { resolveContext } from './me.context.service.js';
import { ensureProfile } from './ensure-profile.js';

const r = Router();
r.use(authenticate);

// GET /api/me/context — full user context in one call
r.get('/context', asyncHandler(async (req, res) => {
  const ctx = await resolveContext(req.user);
  if (!ctx) return res.status(404).json({ error: 'Profil introuvable' });
  res.json(ctx);
}));

// Champ texte optionnel : chaîne vide → null, longueur bornée.
const text = (v, max = 200) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim().slice(0, max);
  return s || null;
};
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

// PATCH /api/me/profile — l'utilisateur complète ses propres informations.
//   Tous      : phone
//   Enseignant: specialization, bio, office, mentionId (le département suit la mention),
//               academicTitle, highestDegree, yearsExperience
//   Personnel : office
//   Parent    : occupation, relationship
r.patch('/profile', asyncHandler(async (req, res) => {
  const { sub: userId, systemRole } = req.user;
  const b = req.body ?? {};
  await ensureProfile(userId, systemRole);

  const phone = text(b.phone, 30);
  if (phone !== undefined) await prisma.user.update({ where: { id: userId }, data: { phone } });

  if (systemRole === 'TEACHER') {
    const data = clean({ specialization: text(b.specialization, 120), bio: text(b.bio, 1500), office: text(b.office, 80), highestDegree: text(b.highestDegree, 200) });
    if (b.academicTitle !== undefined) {
      if (b.academicTitle && !['PROFESSEUR', 'DOCTEUR'].includes(b.academicTitle)) throw new HttpError(400, 'Titre académique invalide');
      data.academicTitle = b.academicTitle || null;
    }
    if (b.yearsExperience !== undefined) {
      const years = b.yearsExperience === null || b.yearsExperience === '' ? null : Number(b.yearsExperience);
      if (years !== null && (!Number.isInteger(years) || years < 0 || years > 70)) throw new HttpError(400, "Années d'expérience invalides");
      data.yearsExperience = years;
    }
    if (b.mentionId !== undefined) {
      if (b.mentionId) {
        const m = await prisma.mention.findUnique({ where: { id: String(b.mentionId) }, select: { id: true, departmentId: true } });
        if (!m) throw new HttpError(400, 'Mention inconnue');
        data.mentionId = m.id;
        data.departmentId = m.departmentId;
      } else {
        data.mentionId = null;
      }
    }
    await prisma.teacherProfile.update({ where: { userId }, data });
  } else if (systemRole === 'PARENT') {
    await prisma.parentProfile.update({ where: { userId }, data: clean({ occupation: text(b.occupation, 120), relationship: text(b.relationship, 60) }) });
  } else if (!['STUDENT', 'STUDENT_ONLINE', 'TEACHER_ONLINE', 'SUPER_ADMIN', 'CANDIDATE'].includes(systemRole)) {
    await prisma.staffProfile.update({ where: { userId }, data: clean({ office: text(b.office, 80) }) });
  }

  res.json(await resolveContext(req.user));
}));

export default r;
