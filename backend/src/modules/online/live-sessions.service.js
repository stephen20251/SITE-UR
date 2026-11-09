import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { getCourseOwned, isSuperAdmin } from './online.guards.js';
import { notifyUsers } from '../../utils/notify.js';
import { cursusAccess } from '../cursus/cursus.access.js';
import { hasActiveSubscription } from './subscription.service.js';

// ─── Teacher ───
export async function createSession(courseId, teacherId, input) {
  await getCourseOwned(courseId, teacherId);

  const session = await prisma.liveSession.create({
    data: {
      courseId,
      teacherId,
      title: input.title,
      description: input.description?.trim() || null,
      scheduledAt: new Date(input.scheduledAt),
      durationMin: input.durationMin ?? 60,
      link: input.link || null,
    },
    include: { teacher: { select: { firstName: true, lastName: true } } },
  });

  const enrolled = await prisma.enrollment.findMany({ where: { courseId }, select: { studentId: true } });
  notifyUsers(
    enrolled.map((e) => e.studentId),
    {
      type: 'ANNOUNCEMENT',
      title: '📅 Session live programmée',
      body: `${input.title} — ${new Date(input.scheduledAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}`,
      link: `/online/live/${session.id}`,
    },
  ).catch(() => {});

  return session;
}

export async function updateSession(sessionId, teacherId, patch) {
  const session = await prisma.liveSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new HttpError(404, 'Session not found');
  if (session.teacherId !== teacherId && !await isSuperAdmin(teacherId)) throw new HttpError(403, 'Not your session');

  const { title, description, scheduledAt, durationMin, link, status, recordingUrl } = patch;
  // Affiché comme lien cliquable : uniquement http(s).
  if (recordingUrl && !/^https?:\/\//i.test(String(recordingUrl).trim())) {
    throw new HttpError(400, "Le lien de l'enregistrement doit commencer par http:// ou https://");
  }
  return prisma.liveSession.update({
    where: { id: sessionId },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(scheduledAt !== undefined && { scheduledAt: new Date(scheduledAt) }),
      ...(durationMin !== undefined && { durationMin }),
      ...(link !== undefined && { link: link || null }),
      ...(status !== undefined && { status }),
      ...(recordingUrl !== undefined && { recordingUrl: String(recordingUrl ?? '').trim() || null }),
    },
    include: { teacher: { select: { firstName: true, lastName: true } } },
  });
}

export async function deleteSession(sessionId, teacherId) {
  const session = await prisma.liveSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new HttpError(404, 'Session not found');
  if (session.teacherId !== teacherId && !await isSuperAdmin(teacherId)) throw new HttpError(403, 'Not your session');
  await prisma.liveSession.delete({ where: { id: sessionId } });
}

// Enregistrements : l'enseignant du cours et l'admin ; côté étudiant, il faut avoir
// accès au cours. Dans le cursus, l'étudiant en présentiel n'y a pas droit.
async function canSeeRecordings(course, user) {
  if (!course) return false;
  if (course.teacherId === user.sub || user.systemRole === 'SUPER_ADMIN') return true;
  const cursus = await cursusAccess(user, course);
  if (cursus.applies) return Boolean(cursus.accessible && !cursus.videosReserved);
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId: user.sub, courseId: course.id } },
    select: { viaSubscription: true },
  });
  if (!enrollment) return false;
  return !enrollment.viaSubscription || await hasActiveSubscription(user.sub);
}

export async function listForCourse(courseId, user) {
  const [sessions, course] = await Promise.all([
    prisma.liveSession.findMany({
      where: { courseId },
      orderBy: { scheduledAt: 'asc' },
      include: { teacher: { select: { firstName: true, lastName: true, avatarUrl: true } } },
    }),
    prisma.onlineCourse.findUnique({
      where: { id: courseId },
      select: { id: true, teacherId: true, courseKind: true, cursusLevel: true, cursusMonth: true, mentionId: true, relatedCourseIds: true },
    }),
  ]);
  if (await canSeeRecordings(course, user)) return sessions;
  return sessions.map((s) => ({ ...s, recordingUrl: null }));
}

// ─── Student: upcoming sessions across all enrolled courses ───
export async function myUpcomingSessions(studentId) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    select: { courseId: true },
  });
  const courseIds = enrollments.map((e) => e.courseId);
  if (!courseIds.length) return [];

  return prisma.liveSession.findMany({
    where: {
      courseId: { in: courseIds },
      status: { in: ['SCHEDULED', 'LIVE'] },
      scheduledAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) }, // include sessions up to 2h past
    },
    orderBy: { scheduledAt: 'asc' },
    take: 20,
    include: {
      course: { select: { id: true, title: true, slug: true, thumbnail: true } },
      teacher: { select: { firstName: true, lastName: true, avatarUrl: true } },
    },
  });
}
