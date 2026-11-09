import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import bcrypt from 'bcrypt';
import { STUDY_MODES } from '../cursus/cursus.access.js';
import { generateTempPassword } from '../../utils/password.js';

const STUDENT_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, phone: true, isActive: true } },
  promotion: { select: { id: true, name: true, level: true, academicYear: { select: { id: true, label: true } } } },
  group:     { select: { id: true, name: true } },
  mention:   { select: { id: true, name: true, code: true } },
};

// Auto-generate a unique matricule (skips numbers already taken)
export async function generateMatricule(mentionCode, academicYearLabel) {
  const year = (academicYearLabel ?? new Date().getFullYear().toString()).slice(0, 4);
  // M-INFO → INF, M-GEST → GES
  const code = mentionCode.toUpperCase().replace(/^M-/, '').slice(0, 3);
  const prefix = `${code}-${year}`;
  let n = await prisma.studentProfile.count({
    where: { matricule: { startsWith: prefix } },
  });
  for (;;) {
    const matricule = `${prefix}-${String(++n).padStart(4, '0')}`;
    if (!await prisma.studentProfile.findUnique({ where: { matricule }, select: { id: true } })) return matricule;
  }
}

// Mode d'étude : obligatoirement PRESENTIEL ou EN_LIGNE.
function parseStudyMode(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (!STUDY_MODES.includes(value)) throw new HttpError(400, "Mode d'étude invalide (PRESENTIEL ou EN_LIGNE)");
  return value;
}

// ── List enrolled students ────────────────────────────────────────────────────

export async function listStudents({ academicYearId, mentionId, promotionId, groupId, status, studyMode, q, page = 1, limit = 30 }) {
  const where = {};
  if (mentionId)   where.mentionId   = mentionId;
  if (promotionId) where.promotionId = promotionId;
  if (groupId)     where.groupId     = groupId;
  if (status)      where.status      = status;
  if (studyMode)   where.studyMode   = parseStudyMode(studyMode);
  if (academicYearId) {
    where.promotion = { academicYearId };
  }
  if (q) {
    where.user = {
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName:  { contains: q, mode: 'insensitive' } },
        { email:     { contains: q, mode: 'insensitive' } },
      ],
    };
    if (academicYearId) where.promotion = { academicYearId };
    where.OR = [
      { matricule: { contains: q, mode: 'insensitive' } },
      { user: { OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName:  { contains: q, mode: 'insensitive' } },
        { email:     { contains: q, mode: 'insensitive' } },
      ]}},
    ];
  }

  const [total, items] = await Promise.all([
    prisma.studentProfile.count({ where }),
    prisma.studentProfile.findMany({
      where,
      include: STUDENT_INCLUDE,
      orderBy: [{ mention: { name: 'asc' } }, { matricule: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { total, page, limit, items };
}

// ── Enroll a new student (create user + profile) ─────────────────────────────

export async function enrollStudent({ firstName, lastName, email, phone, password, promotionId, groupId, mentionId, scholarship, studyMode }) {
  const mode = parseStudyMode(studyMode);
  // Validate promotion + mention exist
  const promo = await prisma.promotion.findUnique({
    where: { id: promotionId },
    include: { mention: true, academicYear: true },
  });
  if (!promo) throw new HttpError(404, 'Promotion introuvable');

  const resolvedMentionId = mentionId ?? promo.mentionId;
  const mention = promo.mention ?? await prisma.mention.findUnique({ where: { id: resolvedMentionId } });
  if (!mention) throw new HttpError(404, 'Mention introuvable');

  // Check email uniqueness
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, 'Un utilisateur avec cet e-mail existe déjà');

  if (password && password.length < 8) throw new HttpError(400, 'Mot de passe trop court (8 caractères minimum)');
  // Sans mot de passe saisi : un mot de passe provisoire, renvoyé une seule fois.
  const temporaryPassword = password ? undefined : generateTempPassword();
  const hash = await bcrypt.hash(password || temporaryPassword, 12);
  const matricule = await generateMatricule(mention.code, promo.academicYear?.label);

  const profile = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        firstName, lastName, email,
        phone: phone || null,
        passwordHash: hash,
        systemRole: 'STUDENT',
        isActive: true,
        emailVerified: true,
      },
    });
    return tx.studentProfile.create({
      data: {
        userId: user.id,
        promotionId,
        groupId: groupId || null,
        mentionId: resolvedMentionId,
        matricule,
        scholarship: scholarship ?? false,
        status: 'ACTIVE',
        ...(mode && { studyMode: mode }),
      },
      include: STUDENT_INCLUDE,
    });
  });

  return { ...profile, ...(temporaryPassword && { temporaryPassword }) };
}

// ── Enroll existing user (user already exists, create profile) ────────────────

export async function enrollExistingUser({ userId, promotionId, groupId, mentionId, scholarship, studyMode }) {
  const mode = parseStudyMode(studyMode);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, 'Utilisateur introuvable');

  const alreadyEnrolled = await prisma.studentProfile.findUnique({ where: { userId } });
  if (alreadyEnrolled) throw new HttpError(409, 'Cet utilisateur est déjà inscrit');

  const promo = await prisma.promotion.findUnique({
    where: { id: promotionId },
    include: { mention: true, academicYear: true },
  });
  if (!promo) throw new HttpError(404, 'Promotion introuvable');

  const resolvedMentionId = mentionId ?? promo.mentionId;
  const mention = promo.mention ?? await prisma.mention.findUnique({ where: { id: resolvedMentionId } });
  const matricule = await generateMatricule(mention?.code ?? 'ETU', promo.academicYear?.label);

  // Un candidat / utilisateur inscrit devient étudiant.
  if (!['STUDENT', 'SUPER_ADMIN'].includes(user.systemRole)) {
    await prisma.user.update({ where: { id: userId }, data: { systemRole: 'STUDENT' } });
  }
  return prisma.studentProfile.create({
    data: {
      userId,
      promotionId,
      groupId: groupId || null,
      mentionId: resolvedMentionId,
      matricule,
      scholarship: scholarship ?? false,
      status: 'ACTIVE',
      ...(mode && { studyMode: mode }),
    },
    include: STUDENT_INCLUDE,
  });
}

// ── Update enrollment (change group, status, etc.) ───────────────────────────

export async function updateEnrollment(profileId, patch) {
  const profile = await prisma.studentProfile.findUnique({ where: { id: profileId } });
  if (!profile) throw new HttpError(404, 'Inscription introuvable');

  const allowed = ['promotionId', 'groupId', 'mentionId', 'status', 'scholarship', 'notes', 'studyMode'];
  const data = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
  if (data.studyMode !== undefined) data.studyMode = parseStudyMode(data.studyMode);

  return prisma.studentProfile.update({
    where: { id: profileId },
    data,
    include: STUDENT_INCLUDE,
  });
}

// ── Get one student profile ───────────────────────────────────────────────────

export async function getStudentProfile(profileId) {
  const profile = await prisma.studentProfile.findUnique({
    where: { id: profileId },
    include: STUDENT_INCLUDE,
  });
  if (!profile) throw new HttpError(404, 'Inscription introuvable');
  return profile;
}

// ── List users not yet enrolled (potential students) ─────────────────────────

export async function listUnenrolledUsers({ q = '' } = {}) {
  const enrolled = await prisma.studentProfile.findMany({ select: { userId: true } });
  const enrolledIds = enrolled.map((e) => e.userId);

  const where = {
    systemRole: 'STUDENT',
    id: { notIn: enrolledIds.length ? enrolledIds : ['__none__'] },
  };
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName:  { contains: q, mode: 'insensitive' } },
      { email:     { contains: q, mode: 'insensitive' } },
    ];
  }

  return prisma.user.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, email: true, createdAt: true },
    take: 20,
    orderBy: { createdAt: 'desc' },
  });
}

// ── Stats per mention ─────────────────────────────────────────────────────────

export async function getInscriptionStats(academicYearId) {
  const where = academicYearId ? { promotion: { academicYearId } } : {};
  const [total, active, byStatus, online] = await Promise.all([
    prisma.studentProfile.count({ where }),
    prisma.studentProfile.count({ where: { ...where, status: 'ACTIVE' } }),
    prisma.studentProfile.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.studentProfile.count({ where: { ...where, studyMode: 'EN_LIGNE' } }),
  ]);
  return { total, active, byStatus, online, presentiel: total - online };
}
