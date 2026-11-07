import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { getCourseOwned, isSuperAdmin } from './online.guards.js';
import { notifyUsers } from '../../utils/notify.js';

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

  const { title, description, scheduledAt, durationMin, link, status } = patch;
  return prisma.liveSession.update({
    where: { id: sessionId },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(scheduledAt !== undefined && { scheduledAt: new Date(scheduledAt) }),
      ...(durationMin !== undefined && { durationMin }),
      ...(link !== undefined && { link: link || null }),
      ...(status !== undefined && { status }),
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

export async function listForCourse(courseId) {
  return prisma.liveSession.findMany({
    where: { courseId },
    orderBy: { scheduledAt: 'asc' },
    include: { teacher: { select: { firstName: true, lastName: true, avatarUrl: true } } },
  });
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
