/**
 * course-review.service.js — validation des cours avant publication
 *
 * Un enseignant soumet son cours (DRAFT → REVIEW). Le cours est validé par le
 * Super Admin ou par le Responsable de la mention concernée (permission
 * APPROVE_COURSE sur cette mention) : « valider et publier » ou « renvoyer à
 * l'enseignant » avec un commentaire. L'enseignant ne publie jamais seul.
 */
import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { notifyUser, notifyUsers } from '../../utils/notify.js';

// Mention dont relève un cours : celle du cours (cursus), sinon celle de l'enseignant.
export async function courseMentionId(course) {
  if (course.mentionId) return course.mentionId;
  const tp = await prisma.teacherProfile.findUnique({ where: { userId: course.teacherId }, select: { mentionId: true } });
  if (tp?.mentionId) return tp.mentionId;
  const ur = await prisma.userRole.findFirst({ where: { userId: course.teacherId, mentionId: { not: null } }, select: { mentionId: true } });
  return ur?.mentionId ?? null;
}

// Rôles « valideurs » (permission APPROVE_COURSE), avec leur mention.
async function approverRoles(where = {}) {
  return prisma.userRole.findMany({
    where: { ...where, role: { rolePermissions: { some: { permission: { code: 'APPROVE_COURSE' } } } }, user: { isActive: true } },
    select: { userId: true, mentionId: true, user: { select: { systemRole: true } } },
  });
}

export async function canReviewCourse(userId, course) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
  if (u?.systemRole === 'SUPER_ADMIN') return true;
  const mentionId = await courseMentionId(course);
  if (!mentionId) return false;
  const roles = await approverRoles({ userId, mentionId });
  return roles.length > 0;
}

// Super Admins + Responsable(s) de la mention du cours.
export async function courseReviewers(course) {
  const mentionId = await courseMentionId(course);
  const [admins, responsables] = await Promise.all([
    prisma.user.findMany({ where: { systemRole: 'SUPER_ADMIN', isActive: true }, select: { id: true } }),
    mentionId ? approverRoles({ mentionId }) : [],
  ]);
  return [...new Set([...admins.map((a) => a.id), ...responsables.map((r) => r.userId)])];
}

// ─── Transitions de statut ──────────────────────────────────────────────────
const VALID_TRANSITIONS = {
  DRAFT: ['REVIEW'],
  REVIEW: ['PUBLISHED', 'APPROVED', 'DRAFT'],
  APPROVED: ['PUBLISHED', 'DRAFT'],
  PUBLISHED: ['ARCHIVED', 'DRAFT'],
  ARCHIVED: ['DRAFT'],
};

const COURSE_SELECT = { id: true, title: true, status: true, teacherId: true, mentionId: true, publishedAt: true };

export async function transitionCourseStatus(courseId, userId, targetStatus, note) {
  const course = await prisma.onlineCourse.findUnique({ where: { id: courseId }, select: { ...COURSE_SELECT, statusHistory: true } });
  if (!course) throw new HttpError(404, 'Course not found');
  const isOwner = course.teacherId === userId;
  const reviewer = await canReviewCourse(userId, course);
  if (!isOwner && !reviewer) throw new HttpError(403, 'Forbidden');

  if (!(VALID_TRANSITIONS[course.status] ?? []).includes(targetStatus)) {
    throw new HttpError(422, `Transition impossible : ${course.status} → ${targetStatus}`);
  }
  // Soumission : la mention doit être connue pour adresser le cours au bon Responsable.
  if (targetStatus === 'REVIEW' && !(await courseMentionId(course))) {
    throw new HttpError(400, 'Choisissez la mention du cours (onglet Informations) : elle désigne le Responsable qui le validera.');
  }
  // Valider un cours soumis : réservé au Super Admin et au Responsable de la mention.
  if (course.status === 'REVIEW' && ['APPROVED', 'PUBLISHED'].includes(targetStatus) && !reviewer) {
    throw new HttpError(403, 'La validation est faite par le Responsable de la mention ou le Super Admin.');
  }
  // Refus par un valideur : un commentaire est obligatoire pour l'enseignant.
  const rejecting = course.status === 'REVIEW' && targetStatus === 'DRAFT' && !isOwner;
  if (rejecting && !note?.trim()) throw new HttpError(400, "Indiquez à l'enseignant ce qu'il doit corriger.");

  const now = new Date().toISOString();
  const history = [];
  if (course.status === 'REVIEW' && targetStatus === 'PUBLISHED') {
    history.push({ status: 'APPROVED', changedAt: now, changedBy: userId, note: note ?? null });
  }
  history.push({ status: targetStatus, changedAt: now, changedBy: userId, note: note ?? null });

  const updated = await prisma.onlineCourse.update({
    where: { id: courseId },
    data: {
      status: targetStatus,
      ...(targetStatus === 'PUBLISHED' && { publishedAt: course.publishedAt ?? new Date() }),
      reviewNote: note ?? null,
      // Historique en liste JSON (MySQL) : on ajoute les nouvelles étapes à la suite.
      statusHistory: [...(Array.isArray(course.statusHistory) ? course.statusHistory : []), ...history],
    },
    select: { id: true, status: true, publishedAt: true, statusHistory: true, reviewNote: true },
  });

  // Notifications
  if (targetStatus === 'REVIEW') {
    const ids = (await courseReviewers(course)).filter((id) => id !== userId);
    notifyUsers(ids, {
      type: 'INFO',
      title: 'Cours à valider',
      body: `« ${course.title} » a été soumis pour validation avant publication.`,
      link: '/classroom/validation-cours',
    }).catch(() => {});
  } else if (!isOwner && course.status === 'REVIEW') {
    notifyUser(course.teacherId, targetStatus === 'DRAFT'
      ? { type: 'WARNING', title: 'Cours à corriger', body: `« ${course.title} » vous est renvoyé : ${note}`, link: `/online/studio/${course.id}` }
      : { type: 'SUCCESS', title: targetStatus === 'PUBLISHED' ? 'Cours validé et publié ✅' : 'Cours validé ✅', body: `« ${course.title} »${note ? ` — ${note}` : ''}`, link: `/online/studio/${course.id}` },
    ).catch(() => {});
  }
  return updated;
}

// ─── File de validation ─────────────────────────────────────────────────────
export async function reviewQueue(userId, { status = 'REVIEW' } = {}) {
  const statuses = status === 'ALL' ? ['REVIEW', 'APPROVED'] : [status];
  const courses = await prisma.onlineCourse.findMany({
    where: { status: { in: statuses } },
    select: {
      ...COURSE_SELECT, subtitle: true, description: true, courseKind: true, cursusLevel: true, cursusMonth: true,
      updatedAt: true, statusHistory: true, price: true,
      teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
      category: { select: { name: true } },
      _count: { select: { modules: true, quizzes: true } },
    },
    orderBy: { updatedAt: 'asc' },
  });
  const out = [];
  for (const c of courses) {
    if (!(await canReviewCourse(userId, c))) continue;
    const mentionId = await courseMentionId(c);
    const mention = mentionId ? await prisma.mention.findUnique({ where: { id: mentionId }, select: { name: true } }) : null;
    const lessons = await prisma.onlineLesson.count({ where: { module: { courseId: c.id } } });
    const submitted = [...(c.statusHistory ?? [])].reverse().find((h) => h?.status === 'REVIEW');
    out.push({ ...c, mention: mention?.name ?? null, lessons, submittedAt: submitted?.changedAt ?? c.updatedAt, statusHistory: undefined });
  }
  return out;
}

export async function assertCanReview(userId, courseId) {
  const course = await prisma.onlineCourse.findUnique({ where: { id: courseId }, select: COURSE_SELECT });
  if (!course) throw new HttpError(404, 'Cours introuvable');
  if (!(await canReviewCourse(userId, course))) throw new HttpError(403, "Ce cours ne relève pas de votre mention");
  return course;
}
