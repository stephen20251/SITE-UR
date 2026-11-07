import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { getCourseOwned, getModuleOwned, getLessonOwned } from './online.guards.js';

// Append-by-default ordering: when the client omits `order`, place the new
// module/lesson at the end (max + 1) so the unique [parent, order] holds.
async function nextModuleOrder(courseId) {
  const agg = await prisma.onlineModule.aggregate({ where: { courseId }, _max: { order: true } });
  return (agg._max.order ?? -1) + 1;
}

async function nextLessonOrder(moduleId) {
  const agg = await prisma.onlineLesson.aggregate({ where: { moduleId }, _max: { order: true } });
  return (agg._max.order ?? -1) + 1;
}

// ─── Modules ───

export async function createModule(courseId, teacherId, input) {
  await getCourseOwned(courseId, teacherId);
  const order = input.order ?? (await nextModuleOrder(courseId));
  return prisma.onlineModule.create({
    data: { courseId, title: input.title, description: input.description ?? null, order },
  });
}

export async function updateModule(moduleId, teacherId, patch) {
  const mod = await getModuleOwned(moduleId, teacherId);
  // A prerequisite must be another module of the same course (never itself).
  if (patch.prerequisiteModuleId) {
    if (patch.prerequisiteModuleId === moduleId) {
      throw new HttpError(400, 'Un module ne peut pas être son propre prérequis');
    }
    const prereq = await prisma.onlineModule.findUnique({
      where: { id: patch.prerequisiteModuleId },
      select: { courseId: true },
    });
    if (!prereq || prereq.courseId !== mod.courseId) {
      throw new HttpError(400, 'Le prérequis doit être un module du même cours');
    }
  }
  return prisma.onlineModule.update({ where: { id: moduleId }, data: patch });
}

export async function deleteModule(moduleId, teacherId) {
  await getModuleOwned(moduleId, teacherId);
  await prisma.onlineModule.delete({ where: { id: moduleId } }); // cascades to lessons
}

// ─── Lessons ───

export async function createLesson(moduleId, teacherId, input) {
  await getModuleOwned(moduleId, teacherId);
  if (input.type === 'LINK' && !input.contentUrl) throw new HttpError(400, 'Indiquez le lien (URL) de la leçon');
  const order = input.order ?? (await nextLessonOrder(moduleId));
  return prisma.onlineLesson.create({
    data: {
      moduleId,
      title: input.title,
      type: input.type,
      contentUrl: input.contentUrl,
      body: input.body,
      duration: input.duration,
      order,
    },
  });
}

export async function updateLesson(lessonId, teacherId, patch) {
  await getLessonOwned(lessonId, teacherId);
  return prisma.onlineLesson.update({ where: { id: lessonId }, data: patch });
}

export async function deleteLesson(lessonId, teacherId) {
  await getLessonOwned(lessonId, teacherId);
  await prisma.onlineLesson.delete({ where: { id: lessonId } });
}

export async function reorderModules(courseId, teacherId, items) {
  await getCourseOwned(courseId, teacherId);
  await Promise.all(
    items.map(({ id, order }) => prisma.onlineModule.update({ where: { id }, data: { order } }))
  );
  return prisma.onlineModule.findMany({ where: { courseId }, orderBy: { order: 'asc' } });
}

export async function reorderLessons(moduleId, teacherId, items) {
  await getModuleOwned(moduleId, teacherId);
  await Promise.all(
    items.map(({ id, order }) => prisma.onlineLesson.update({ where: { id }, data: { order } }))
  );
  return prisma.onlineLesson.findMany({ where: { moduleId }, orderBy: { order: 'asc' } });
}
