import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';

export function create(input) {
  return prisma.department.create({ data: input });
}

export function list() {
  return prisma.department.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { classes: true, students: true, teachers: true } } },
  });
}

export async function get(id) {
  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      classes: { select: { id: true, name: true, level: true, academicYear: true } },
      _count: { select: { students: true, teachers: true } },
    },
  });
  if (!department) throw new HttpError(404, 'Department not found');
  return department;
}

export function update(id, patch) {
  return prisma.department.update({ where: { id }, data: patch });
}

export async function remove(id) {
  const classes = await prisma.classroomClass.count({ where: { departmentId: id } });
  if (classes > 0) throw new HttpError(409, 'Department still has classes — reassign or delete them first');
  await prisma.department.delete({ where: { id } });
}
