import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { isSuperAdmin } from './online.guards.js';

const pathWithSteps = {
  id: true, title: true, description: true, thumbnail: true, status: true, createdAt: true,
  creator: { select: { firstName: true, lastName: true } },
  steps: {
    orderBy: { order: 'asc' },
    include: {
      course: {
        select: {
          id: true, title: true, slug: true, thumbnail: true, status: true,
          teacher: { select: { firstName: true, lastName: true } },
          _count: { select: { modules: true, enrollments: true } },
        },
      },
    },
  },
};

export async function listPaths({ published } = {}) {
  return prisma.learningPath.findMany({
    where: published ? { status: 'PUBLISHED' } : {},
    orderBy: { createdAt: 'desc' },
    select: pathWithSteps,
  });
}

export async function getPath(pathId) {
  const path = await prisma.learningPath.findUnique({ where: { id: pathId }, select: pathWithSteps });
  if (!path) throw new HttpError(404, 'Learning path not found');
  return path;
}

export async function createPath(createdBy, input) {
  return prisma.learningPath.create({
    data: {
      title: input.title,
      description: input.description,
      thumbnail: input.thumbnail,
      createdBy,
      steps: input.courseIds
        ? {
            create: input.courseIds.map((courseId, i) => ({ courseId, order: i })),
          }
        : undefined,
    },
    select: pathWithSteps,
  });
}

export async function updatePath(pathId, createdBy, patch) {
  const path = await prisma.learningPath.findUnique({ where: { id: pathId } });
  if (!path) throw new HttpError(404, 'Learning path not found');
  if (path.createdBy !== createdBy && !await isSuperAdmin(createdBy)) throw new HttpError(403, 'Not your learning path');

  const { title, description, thumbnail, status, courseIds } = patch;
  return prisma.learningPath.update({
    where: { id: pathId },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(thumbnail !== undefined && { thumbnail }),
      ...(status !== undefined && { status }),
      ...(courseIds !== undefined && {
        steps: {
          deleteMany: {},
          create: courseIds.map((courseId, i) => ({ courseId, order: i })),
        },
      }),
    },
    select: pathWithSteps,
  });
}

export async function deletePath(pathId, createdBy) {
  const path = await prisma.learningPath.findUnique({ where: { id: pathId } });
  if (!path) throw new HttpError(404, 'Learning path not found');
  if (path.createdBy !== createdBy && !await isSuperAdmin(createdBy)) throw new HttpError(403, 'Not your learning path');
  await prisma.learningPath.delete({ where: { id: pathId } });
}

// ─── Student: learning paths with per-course enrollment state ───
export async function pathsForStudent(studentId) {
  const paths = await prisma.learningPath.findMany({
    where: { status: 'PUBLISHED' },
    select: pathWithSteps,
  });

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    select: { courseId: true, progress: true, completedAt: true },
  });
  const enrollMap = new Map(enrollments.map((e) => [e.courseId, e]));

  return paths.map((p) => ({
    ...p,
    steps: p.steps.map((s) => ({
      ...s,
      enrollment: enrollMap.get(s.courseId) ?? null,
    })),
  }));
}
