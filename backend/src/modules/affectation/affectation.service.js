import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { loadStaffContext } from '../../middlewares/rbac.js';
import { ensureProfile } from '../me/ensure-profile.js';
import { hashPassword } from '../../utils/hash.js';
import { generateTempPassword } from '../../utils/password.js';
import { sendAccountCreatedEmail } from '../../utils/account-emails.js';
import { notifyUser } from '../../utils/notify.js';
import { assignCurriculumFromSubject, releaseCurriculumFromSubject } from '../structure/subject-sync.js';

// Mentions du périmètre de l'utilisateur (null = toutes : Super administrateur).
async function scopeMentionIds(req) {
  const staff = await loadStaffContext(req);
  return staff.isAdmin || staff.mentionIds.length === 0 ? null : staff.mentionIds;
}
async function assertMention(req, mentionId) {
  const ids = await scopeMentionIds(req);
  if (ids && !ids.includes(mentionId)) throw new HttpError(403, 'Cette mention ne fait pas partie de votre périmètre');
}

// ── Enseignants ──────────────────────────────────────────────────────────────

// Tous les comptes enseignants actifs, y compris ceux dont la fiche n'existe pas encore.
export async function listTeachers(q = '') {
  const s = String(q ?? '').trim();
  const users = await prisma.user.findMany({
    where: {
      systemRole: 'TEACHER', isActive: true,
      ...(s && { OR: [{ firstName: { contains: s } }, { lastName: { contains: s } }, { email: { contains: s } }] }),
    },
    select: {
      id: true, firstName: true, lastName: true, email: true,
      teacherProfile: { select: { id: true, specialization: true, mention: { select: { name: true } }, _count: { select: { subjectTeachers: true } } } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: 200,
  });
  return users.map((u) => ({
    userId: u.id,
    id: u.teacherProfile?.id ?? null,
    fullName: `${u.lastName.toUpperCase()} ${u.firstName}`,
    email: u.email,
    specialization: u.teacherProfile?.specialization ?? u.teacherProfile?.mention?.name ?? 'Enseignant',
    subjectsCount: u.teacherProfile?._count.subjectTeachers ?? 0,
  }));
}

export async function createTeacher(req, body) {
  const email = String(body.email ?? '').toLowerCase().trim();
  const firstName = String(body.firstName ?? '').trim();
  const lastName = String(body.lastName ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Adresse e-mail invalide');
  if (!firstName || !lastName) throw new HttpError(400, 'Prénom et nom obligatoires');
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new HttpError(409, 'Cette adresse e-mail est déjà utilisée par un compte');
  }
  // Mention de rattachement : celle choisie, sinon la mention du Responsable.
  const scope = await scopeMentionIds(req);
  const mentionId = body.mentionId || (scope?.length === 1 ? scope[0] : null);
  if (mentionId) await assertMention(req, mentionId);

  const temporaryPassword = generateTempPassword();
  const user = await prisma.user.create({
    data: {
      email, firstName, lastName, phone: String(body.phone ?? '').trim() || null,
      systemRole: 'TEACHER', passwordHash: await hashPassword(temporaryPassword),
      emailVerified: true, isActive: true,
    },
  });
  await ensureProfile(user.id, 'TEACHER');
  const profile = await prisma.teacherProfile.update({
    where: { userId: user.id },
    data: { mentionId, specialization: String(body.specialization ?? '').trim() || null },
  });
  const emailSent = await sendAccountCreatedEmail(user, { temporaryPassword });
  return {
    userId: user.id, id: profile.id, email, emailSent, temporaryPassword,
    fullName: `${lastName.toUpperCase()} ${firstName}`,
    specialization: profile.specialization ?? 'Enseignant', subjectsCount: 0,
  };
}

// ── Matières ─────────────────────────────────────────────────────────────────

export async function createSubject(req, body) {
  const name = String(body.name ?? '').trim();
  const code = String(body.code ?? '').trim().toUpperCase();
  if (!body.mentionId || !name || !code) throw new HttpError(400, 'Mention, code et intitulé obligatoires');
  await assertMention(req, body.mentionId);
  const taken = await prisma.subject.findUnique({ where: { code }, select: { name: true } });
  if (taken) throw new HttpError(409, `Le code ${code} est déjà utilisé par la matière « ${taken.name} »`);
  return prisma.subject.create({
    data: {
      mentionId: body.mentionId, code, name,
      credits: Number(body.credits) > 0 ? Number(body.credits) : 3,
      weeklyHours: Number(body.weeklyHours) > 0 ? Number(body.weeklyHours) : 2,
      teachingUnitId: body.teachingUnitId || null,
      description: body.description || null,
    },
  });
}

const TEACHER_INCLUDE = {
  teacher: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      mention: { select: { name: true } },
    },
  },
  subject: { select: { id: true, code: true, name: true, credits: true } },
  group:   { select: { id: true, name: true } },
};

// ── List assignments for a subject ───────────────────────────────────────────

export async function listBySubject(subjectId) {
  return prisma.subjectTeacher.findMany({
    where: { subjectId },
    include: TEACHER_INCLUDE,
    orderBy: { assignedAt: 'asc' },
  });
}

// ── List all assignments with filters ────────────────────────────────────────

export async function listAssignments({ semesterId, mentionId, subjectId, teacherId, page = 1, limit = 50 }) {
  const where = {};
  if (subjectId)  where.subjectId  = subjectId;
  if (teacherId)  where.teacherId  = teacherId;
  if (mentionId || semesterId) {
    where.subject = {
      ...(mentionId   && { mentionId }),
      ...(semesterId  && { teachingUnit: { semesterId } }),
    };
  }

  const [total, items] = await Promise.all([
    prisma.subjectTeacher.count({ where }),
    prisma.subjectTeacher.findMany({
      where,
      include: TEACHER_INCLUDE,
      orderBy: [{ subject: { name: 'asc' } }, { assignedAt: 'asc' }],
      skip:  (page - 1) * limit,
      take:  limit,
    }),
  ]);
  return { total, page, limit, items };
}

// ── Assign teacher to subject ─────────────────────────────────────────────────

export async function assignTeacher({ subjectId, teacherId, teacherUserId, groupId, type, assignedBy }) {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) throw new HttpError(404, 'Matière introuvable');

  // L'enseignant peut être désigné par son compte : sa fiche est créée au besoin.
  if (!teacherId && teacherUserId) {
    const u = await prisma.user.findUnique({ where: { id: teacherUserId }, select: { systemRole: true } });
    if (u?.systemRole !== 'TEACHER') throw new HttpError(400, "Ce compte n'est pas un compte enseignant");
    await ensureProfile(teacherUserId, 'TEACHER');
    teacherId = (await prisma.teacherProfile.findUnique({ where: { userId: teacherUserId }, select: { id: true } }))?.id;
  }
  const teacher = teacherId ? await prisma.teacherProfile.findUnique({ where: { id: teacherId } }) : null;
  if (!teacher) throw new HttpError(404, 'Enseignant introuvable');

  const existing = await prisma.subjectTeacher.findFirst({
    where: { subjectId, teacherId, groupId: groupId || null, type: type ?? 'CM' },
  });
  if (existing) throw new HttpError(409, 'Cette affectation existe déjà');

  const created = await prisma.subjectTeacher.create({
    data: {
      subjectId,
      teacherId,
      groupId: groupId || null,
      type: type ?? 'CM',
      assignedBy,
    },
    include: TEACHER_INCLUDE,
  });
  // Les cours du cursus de cette matière encore sans enseignant lui sont attribués.
  await assignCurriculumFromSubject({ subjectId, teacherProfileId: teacherId });
  notifyUser(teacher.userId, {
    type: 'INFO',
    title: 'Nouvelle matière attribuée',
    body: `« ${subject.name} » (${created.type}) vous a été attribuée. Retrouvez-la dans « Mes cours ».`,
    link: '/classroom/mes-cours',
  }).catch(() => {});
  return created;
}

// ── Remove an assignment ──────────────────────────────────────────────────────

export async function removeAssignment(id) {
  const aff = await prisma.subjectTeacher.findUnique({ where: { id } });
  if (!aff) throw new HttpError(404, 'Affectation introuvable');
  await prisma.subjectTeacher.delete({ where: { id } });
  await releaseCurriculumFromSubject({ subjectId: aff.subjectId, teacherProfileId: aff.teacherId });
  return { success: true };
}

// ── Update assignment type ────────────────────────────────────────────────────

export async function updateAssignment(id, { type, groupId }) {
  const aff = await prisma.subjectTeacher.findUnique({ where: { id } });
  if (!aff) throw new HttpError(404, 'Affectation introuvable');
  return prisma.subjectTeacher.update({
    where: { id },
    data: { type: type ?? aff.type, groupId: groupId !== undefined ? (groupId || null) : aff.groupId },
    include: TEACHER_INCLUDE,
  });
}

// ── List subjects for cascade ─────────────────────────────────────────────────

export async function listSubjectsForAssignment({ mentionId, semesterId } = {}) {
  return prisma.subject.findMany({
    where: {
      ...(mentionId  && { mentionId }),
      ...(semesterId && { teachingUnit: { semesterId } }),
      isActive: true,
    },
    include: {
      mention:      { select: { id: true, name: true } },
      teachingUnit: { select: { id: true, name: true, code: true, semesterId: true } },
      subjectTeachers: { include: {
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        group:   { select: { id: true, name: true } },
      }},
    },
    orderBy: { name: 'asc' },
  });
}
