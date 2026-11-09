import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';

// ─── Ownership guards ───
// Teachers may only mutate their own course tree. Each guard loads the entity,
// walks up to its course, and asserts the requesting teacher owns it.
// SUPER_ADMIN bypasses ownership checks transparently.

export async function isSuperAdmin(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
  return u?.systemRole === 'SUPER_ADMIN';
}

export async function getCourseOwned(courseId, teacherId) {
  const course = await prisma.onlineCourse.findUnique({ where: { id: courseId } });
  if (!course) throw new HttpError(404, 'Course not found');
  if (course.teacherId !== teacherId && !await isSuperAdmin(teacherId)) {
    throw new HttpError(403, 'You do not own this course');
  }
  return course;
}

export async function getModuleOwned(moduleId, teacherId) {
  const mod = await prisma.onlineModule.findUnique({
    where: { id: moduleId },
    include: { course: { select: { id: true, teacherId: true } } },
  });
  if (!mod) throw new HttpError(404, 'Module not found');
  if (mod.course.teacherId !== teacherId && !await isSuperAdmin(teacherId)) {
    throw new HttpError(403, 'You do not own this course');
  }
  return mod;
}

export async function getLessonOwned(lessonId, teacherId) {
  const lesson = await prisma.onlineLesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { id: true, courseId: true, course: { select: { teacherId: true } } } } },
  });
  if (!lesson) throw new HttpError(404, 'Lesson not found');
  if (lesson.module.course.teacherId !== teacherId && !await isSuperAdmin(teacherId)) {
    throw new HttpError(403, 'You do not own this course');
  }
  return lesson;
}

export async function getQuizOwned(quizId, teacherId) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    // La relation du quiz vers son cours en ligne s'appelle « onlineCourse ».
    include: { onlineCourse: { select: { id: true, teacherId: true } } },
  });
  if (!quiz) throw new HttpError(404, 'Quiz not found');
  if (quiz.onlineCourse?.teacherId !== teacherId && !await isSuperAdmin(teacherId)) {
    throw new HttpError(403, 'You do not own this course');
  }
  return { ...quiz, course: quiz.onlineCourse };
}

// ─── Enrollment guard ───
// Students may only consume content / take quizzes for courses they enrolled in.
export async function getEnrollmentOrThrow(studentId, courseId) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
  });
  if (!enrollment) throw new HttpError(403, 'You are not enrolled in this course');
  return enrollment;
}
