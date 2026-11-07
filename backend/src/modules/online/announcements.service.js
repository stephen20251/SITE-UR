import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { notifyUsers } from '../../utils/notify.js';
import { getCourseOwned, isSuperAdmin } from './online.guards.js';

// Reading requires enrollment / ownership; writing requires ownership.
async function requireRead(user, courseId) {
  const course = await prisma.onlineCourse.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, teacherId: true },
  });
  if (!course) throw new HttpError(404, 'Course not found');
  const owner = course.teacherId === user.sub || (await isSuperAdmin(user.sub));
  if (!owner) {
    const enr = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: user.sub, courseId } },
      select: { id: true },
    });
    if (!enr) throw new HttpError(403, 'Vous devez être inscrit pour voir les annonces');
  }
  return course;
}

export async function listAnnouncements(user, courseId) {
  await requireRead(user, courseId);
  return prisma.courseAnnouncement.findMany({
    where: { courseId },
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function createAnnouncement(user, courseId, { title, body, isPinned }) {
  if (!title?.trim() || !body?.trim()) throw new HttpError(400, 'Titre et contenu requis');
  const course = await getCourseOwned(courseId, user.sub);
  const announcement = await prisma.courseAnnouncement.create({
    data: {
      courseId,
      authorId: user.sub,
      title: title.trim(),
      body: body.trim(),
      isPinned: Boolean(isPinned),
    },
  });
  // Push a notification to every enrolled student.
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId },
    select: { studentId: true },
  });
  notifyUsers(enrollments.map((e) => e.studentId), {
    type: 'ANNOUNCEMENT',
    title: `📣 ${course.title}`,
    body: title.trim(),
    link: `/online/course/${courseId}`,
  }).catch(() => {});
  return announcement;
}

export async function updateAnnouncement(user, id, patch) {
  const a = await prisma.courseAnnouncement.findUnique({ where: { id }, select: { courseId: true } });
  if (!a) throw new HttpError(404, 'Annonce introuvable');
  await getCourseOwned(a.courseId, user.sub);
  const data = {};
  if (patch.title !== undefined) data.title = String(patch.title).trim();
  if (patch.body !== undefined) data.body = String(patch.body).trim();
  if (patch.isPinned !== undefined) data.isPinned = Boolean(patch.isPinned);
  return prisma.courseAnnouncement.update({ where: { id }, data });
}

export async function deleteAnnouncement(user, id) {
  const a = await prisma.courseAnnouncement.findUnique({ where: { id }, select: { courseId: true } });
  if (!a) throw new HttpError(404, 'Annonce introuvable');
  await getCourseOwned(a.courseId, user.sub);
  await prisma.courseAnnouncement.delete({ where: { id } });
  return { ok: true };
}
