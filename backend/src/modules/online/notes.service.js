import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { getEnrollmentOrThrow } from './online.guards.js';

const noteShape = {
  id: true,
  courseId: true,
  lessonId: true,
  body: true,
  timestamp: true,
  isBookmark: true,
  createdAt: true,
  updatedAt: true,
  lesson: { select: { id: true, title: true } },
  course: { select: { id: true, title: true } },
};

// ─── Read ───
// A student's own notes/bookmarks. Filterable by course/lesson; bookmarksOnly
// narrows to bookmark markers.
export async function listNotes(studentId, { courseId, lessonId, bookmarksOnly } = {}) {
  const where = {
    studentId,
    ...(courseId && { courseId }),
    ...(lessonId && { lessonId }),
    ...(bookmarksOnly ? { isBookmark: true } : {}),
  };
  return prisma.lessonNote.findMany({
    where,
    select: noteShape,
    orderBy: [{ lessonId: 'asc' }, { timestamp: 'asc' }, { createdAt: 'asc' }],
  });
}

// ─── Write ───
export async function createNote(studentId, { courseId, lessonId, body, timestamp, isBookmark }) {
  if (!courseId || !lessonId) throw new HttpError(400, 'courseId et lessonId requis');
  if (!isBookmark && !body?.trim()) throw new HttpError(400, 'La note ne peut pas être vide');
  await getEnrollmentOrThrow(studentId, courseId);
  // Ensure the lesson actually belongs to the course.
  const lesson = await prisma.onlineLesson.findFirst({
    where: { id: lessonId, module: { courseId } },
    select: { id: true },
  });
  if (!lesson) throw new HttpError(404, 'Leçon introuvable dans ce cours');
  const ts = timestamp === null || timestamp === undefined ? null : Math.max(0, Math.floor(Number(timestamp)));
  return prisma.lessonNote.create({
    data: {
      studentId,
      courseId,
      lessonId,
      body: body?.trim() || '',
      timestamp: Number.isNaN(ts) ? null : ts,
      isBookmark: Boolean(isBookmark),
    },
    select: noteShape,
  });
}

export async function updateNote(studentId, id, { body, timestamp }) {
  const note = await prisma.lessonNote.findUnique({ where: { id }, select: { studentId: true } });
  if (!note || note.studentId !== studentId) throw new HttpError(404, 'Note introuvable');
  const data = {};
  if (body !== undefined) data.body = body?.trim() || '';
  if (timestamp !== undefined) {
    const ts = timestamp === null ? null : Math.max(0, Math.floor(Number(timestamp)));
    data.timestamp = Number.isNaN(ts) ? null : ts;
  }
  return prisma.lessonNote.update({ where: { id }, data, select: noteShape });
}

export async function deleteNote(studentId, id) {
  const note = await prisma.lessonNote.findUnique({ where: { id }, select: { studentId: true } });
  if (!note || note.studentId !== studentId) throw new HttpError(404, 'Note introuvable');
  await prisma.lessonNote.delete({ where: { id } });
  return { ok: true };
}
