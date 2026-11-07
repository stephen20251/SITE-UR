import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { getClassOrThrow } from './classroom.guards.js';

const DEPT = { select: { id: true, name: true, code: true } };
const STUDENT_USER = { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } };

export function create(input) {
  return prisma.classroomClass.create({ data: input, include: { department: DEPT } });
}

export function list({ departmentId, academicYear }) {
  return prisma.classroomClass.findMany({
    where: { ...(departmentId && { departmentId }), ...(academicYear && { academicYear }) },
    orderBy: [{ academicYear: 'desc' }, { name: 'asc' }],
    include: { department: DEPT, _count: { select: { students: true, timetable: true } } },
  });
}

export async function get(id) {
  const klass = await prisma.classroomClass.findUnique({
    where: { id },
    include: {
      department: DEPT,
      students: { include: { user: STUDENT_USER }, orderBy: { studentNo: 'asc' } },
      _count: { select: { students: true, timetable: true } },
    },
  });
  if (!klass) throw new HttpError(404, 'Class not found');
  return klass;
}

export async function update(id, patch) {
  await getClassOrThrow(id);
  return prisma.classroomClass.update({ where: { id }, data: patch, include: { department: DEPT } });
}

export async function remove(id) {
  await getClassOrThrow(id);
  try {
    await prisma.classroomClass.delete({ where: { id } });
  } catch (e) {
    if (e.code === 'P2003') throw new HttpError(409, 'Class has linked records (timetable/attendance/grades)');
    throw e;
  }
}

export async function roster(classId) {
  await getClassOrThrow(classId);
  return prisma.studentProfile.findMany({
    where: { classId },
    include: { user: STUDENT_USER },
    orderBy: { studentNo: 'asc' },
  });
}

export async function assignStudent(classId, studentUserId) {
  await getClassOrThrow(classId);
  const profile = await prisma.studentProfile.findUnique({ where: { userId: studentUserId } });
  if (!profile) throw new HttpError(404, 'Student profile not found — create it first');
  return prisma.studentProfile.update({ where: { userId: studentUserId }, data: { classId } });
}

export async function removeStudent(classId, studentUserId) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId: studentUserId } });
  if (!profile || profile.classId !== classId) throw new HttpError(404, 'Student is not in this class');
  return prisma.studentProfile.update({ where: { userId: studentUserId }, data: { classId: null } });
}
