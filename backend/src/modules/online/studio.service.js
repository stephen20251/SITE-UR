/**
 * studio.service.js — Course Studio advanced features
 * Versions · Comments · LessonFiles · Publication workflow
 */
import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { getCourseOwned } from './online.guards.js';
import { transitionCourseStatus } from './course-review.service.js';
import { isProtectedCourse, signMediaUrl } from '../cursus/cursus.access.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function mimeToLessonType(mime) {
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('audio/')) return 'AUDIO';
  if (mime.startsWith('image/')) return 'IMAGE';
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z')) return 'ZIP';
  return 'DOCUMENT';
}

async function isAllowed(ownerId, userId) {
  if (ownerId === userId) return true;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
  return u?.systemRole === 'SUPER_ADMIN';
}

async function courseSnaphot(courseId) {
  return prisma.onlineCourse.findUnique({
    where: { id: courseId },
    include: {
      modules: { orderBy: { order: 'asc' }, include: { lessons: { orderBy: { order: 'asc' }, include: { files: true } } } },
      quizzes: { include: { questions: { include: { options: true } } } },
    },
  });
}

// ─── Versions ───────────────────────────────────────────────────────────────

export async function listVersions(courseId, teacherId) {
  await getCourseOwned(courseId, teacherId);
  return prisma.courseVersion.findMany({
    where: { courseId },
    select: { id: true, versionNum: true, label: true, createdAt: true,
              creator: { select: { firstName: true, lastName: true } } },
    orderBy: { versionNum: 'desc' },
  });
}

export async function saveVersion(courseId, teacherId, label) {
  await getCourseOwned(courseId, teacherId);
  const snap = await courseSnaphot(courseId);
  const last = await prisma.courseVersion.findFirst({ where: { courseId }, orderBy: { versionNum: 'desc' } });
  const versionNum = (last?.versionNum ?? 0) + 1;
  return prisma.courseVersion.create({
    data: { courseId, versionNum, label: label ?? `Version ${versionNum}`, snapshot: snap, createdBy: teacherId },
    select: { id: true, versionNum: true, label: true, createdAt: true },
  });
}

export async function restoreVersion(courseId, teacherId, versionNum) {
  await getCourseOwned(courseId, teacherId);
  const version = await prisma.courseVersion.findUnique({ where: { courseId_versionNum: { courseId, versionNum } } });
  if (!version) throw new HttpError(404, 'Version not found');

  const snap = version.snapshot;
  // Save current state as a new version before restoring
  await saveVersion(courseId, teacherId, `Avant restauration v${versionNum}`);

  // Restore top-level fields
  const { id, teacherId: tid, slug, createdAt, updatedAt, modules, quizzes, ...fields } = snap;
  await prisma.onlineCourse.update({ where: { id: courseId }, data: { ...fields } });

  return { restored: versionNum };
}

// ─── Comments ───────────────────────────────────────────────────────────────

export async function listComments(courseId, userId) {
  // Teacher checks ownership, super-admin can see any
  const course = await prisma.onlineCourse.findUnique({ where: { id: courseId }, select: { teacherId: true } });
  if (!course) throw new HttpError(404, 'Course not found');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
  if (course.teacherId !== userId && user?.systemRole !== 'SUPER_ADMIN') throw new HttpError(403, 'Forbidden');

  return prisma.courseComment.findMany({
    where: { courseId, parentId: null },
    include: {
      author: { select: { firstName: true, lastName: true, systemRole: true, avatarUrl: true } },
      replies: {
        include: { author: { select: { firstName: true, lastName: true, systemRole: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function addComment(courseId, authorId, { content, parentId, isAdminNote }) {
  const course = await prisma.onlineCourse.findUnique({ where: { id: courseId }, select: { teacherId: true } });
  if (!course) throw new HttpError(404, 'Course not found');
  const user = await prisma.user.findUnique({ where: { id: authorId }, select: { systemRole: true } });
  const isSuperAdmin = user?.systemRole === 'SUPER_ADMIN';
  if (course.teacherId !== authorId && !isSuperAdmin) throw new HttpError(403, 'Forbidden');

  return prisma.courseComment.create({
    data: {
      courseId,
      authorId,
      content,
      parentId: parentId ?? null,
      isAdminNote: isAdminNote ?? isSuperAdmin,
    },
    include: {
      author: { select: { firstName: true, lastName: true, systemRole: true, avatarUrl: true } },
    },
  });
}

export async function resolveComment(commentId, userId) {
  const comment = await prisma.courseComment.findUnique({ where: { id: commentId }, include: { course: { select: { teacherId: true } } } });
  if (!comment) throw new HttpError(404, 'Comment not found');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
  if (comment.course.teacherId !== userId && user?.systemRole !== 'SUPER_ADMIN') throw new HttpError(403, 'Forbidden');
  return prisma.courseComment.update({ where: { id: commentId }, data: { resolved: true } });
}

export async function deleteComment(commentId, userId) {
  const comment = await prisma.courseComment.findUnique({ where: { id: commentId }, select: { authorId: true } });
  if (!comment) throw new HttpError(404, 'Not found');
  if (comment.authorId !== userId) throw new HttpError(403, 'Forbidden');
  await prisma.courseComment.delete({ where: { id: commentId } });
}

// ─── Lesson files (multiple per lesson) ─────────────────────────────────────

export async function listLessonFiles(lessonId, userId) {
  const lesson = await prisma.onlineLesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: { select: { teacherId: true, courseKind: true } } } } },
  });
  if (!lesson) throw new HttpError(404, 'Lesson not found');
  if (!await isAllowed(lesson.module.course.teacherId, userId)) throw new HttpError(403, 'Forbidden');
  const files = await prisma.lessonFile.findMany({ where: { lessonId }, orderBy: { order: 'asc' } });
  // Fichiers protégés (cursus / non téléchargeables) : aperçu via URL signée.
  const protectedCourse = isProtectedCourse(lesson.module.course);
  return files.map((f) => (f.url?.startsWith('/uploads/') && (protectedCourse || !f.allowDownload))
    ? { ...f, url: signMediaUrl(userId, 'f', f.id) }
    : f);
}

export async function addLessonFile(lessonId, userId, { name, url, mimeType, size, allowDownload }) {
  const lesson = await prisma.onlineLesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: { select: { teacherId: true } } } } },
  });
  if (!lesson) throw new HttpError(404, 'Lesson not found');
  if (!await isAllowed(lesson.module.course.teacherId, userId)) throw new HttpError(403, 'Forbidden');

  const last = await prisma.lessonFile.findFirst({ where: { lessonId }, orderBy: { order: 'desc' } });
  const file = await prisma.lessonFile.create({
    data: { lessonId, name, url, mimeType, size: size ?? 0, order: (last?.order ?? -1) + 1, allowDownload: allowDownload ?? true },
  });

  // If this is the first upload and the lesson has no primary contentUrl, promote it.
  // Skip for TEXT lessons — their body IS the content; files are always attachments.
  if (!lesson.contentUrl && lesson.type !== 'TEXT') {
    await prisma.onlineLesson.update({
      where: { id: lessonId },
      data: { contentUrl: url, type: mimeToLessonType(mimeType) },
    });
  }

  return file;
}

export async function deleteLessonFile(fileId, userId) {
  const file = await prisma.lessonFile.findUnique({
    where: { id: fileId },
    include: { lesson: { include: { module: { include: { course: { select: { teacherId: true } } } } } } },
  });
  if (!file) throw new HttpError(404, 'File not found');
  if (!await isAllowed(file.lesson.module.course.teacherId, userId)) throw new HttpError(403, 'Forbidden');
  await prisma.lessonFile.delete({ where: { id: fileId } });
}

export async function reorderLessonFiles(lessonId, userId, items) {
  const lesson = await prisma.onlineLesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: { select: { teacherId: true } } } } },
  });
  if (!lesson) throw new HttpError(404, 'Lesson not found');
  if (!await isAllowed(lesson.module.course.teacherId, userId)) throw new HttpError(403, 'Forbidden');
  await Promise.all(items.map(({ id, order }) => prisma.lessonFile.update({ where: { id }, data: { order } })));
  return prisma.lessonFile.findMany({ where: { lessonId }, orderBy: { order: 'asc' } });
}

// ─── Module / Lesson visibility ──────────────────────────────────────────────

export async function toggleModuleHidden(moduleId, userId) {
  const m = await prisma.onlineModule.findUnique({ where: { id: moduleId }, include: { course: { select: { teacherId: true } } } });
  if (!m) throw new HttpError(404, 'Module not found');
  if (!await isAllowed(m.course.teacherId, userId)) throw new HttpError(403, 'Forbidden');
  return prisma.onlineModule.update({ where: { id: moduleId }, data: { isHidden: !m.isHidden } });
}

export async function toggleLessonHidden(lessonId, userId) {
  const l = await prisma.onlineLesson.findUnique({ where: { id: lessonId }, include: { module: { include: { course: { select: { teacherId: true } } } } } });
  if (!l) throw new HttpError(404, 'Lesson not found');
  if (!await isAllowed(l.module.course.teacherId, userId)) throw new HttpError(403, 'Forbidden');
  return prisma.onlineLesson.update({ where: { id: lessonId }, data: { isHidden: !l.isHidden } });
}

// ─── Publication workflow ────────────────────────────────────────────────────

// Validation par le Super Admin ou le Responsable de la mention (voir course-review.service).
export function transitionStatus(courseId, userId, targetStatus, note) {
  return transitionCourseStatus(courseId, userId, targetStatus, note);
}

// ─── Enhanced analytics ──────────────────────────────────────────────────────

export async function enhancedAnalytics(courseId, teacherId) {
  await getCourseOwned(courseId, teacherId);

  const [enrollments, lessonProgress, lessons] = await Promise.all([
    prisma.enrollment.findMany({ where: { courseId }, select: { progress: true, completedAt: true } }),
    prisma.onlineLessonProgress.findMany({
      where: { lesson: { module: { courseId } } },
      select: { lessonId: true, completed: true, watchedSec: true },
    }),
    prisma.onlineLesson.findMany({ where: { module: { courseId } }, select: { id: true, title: true, type: true } }),
  ]);

  // Per-lesson stats
  const byLesson = new Map();
  for (const l of lessons) byLesson.set(l.id, { id: l.id, title: l.title, type: l.type, views: 0, completions: 0, totalWatchedSec: 0 });
  for (const p of lessonProgress) {
    const entry = byLesson.get(p.lessonId);
    if (!entry) continue;
    entry.views++;
    if (p.completed) entry.completions++;
    entry.totalWatchedSec += p.watchedSec ?? 0;
  }

  const lessonStats = [...byLesson.values()].map(s => ({
    ...s,
    avgWatchedMin: s.views ? Math.round((s.totalWatchedSec / s.views) / 60 * 10) / 10 : 0,
    completionRate: s.views ? Math.round((s.completions / s.views) * 100) : 0,
    dropoutRate: s.views ? Math.round(((s.views - s.completions) / s.views) * 100) : 0,
  }));

  const topLessons = [...lessonStats].sort((a, b) => b.views - a.views).slice(0, 5);

  const total = enrollments.length;
  const completed = enrollments.filter(e => e.completedAt).length;
  const avgProgress = total ? enrollments.reduce((s, e) => s + e.progress, 0) / total : 0;

  return {
    enrollments: total,
    completed,
    completionRate: Math.round(total ? (completed / total) * 100 : 0),
    avgProgress: Math.round(avgProgress),
    topLessons,
    allLessonStats: lessonStats,
  };
}
