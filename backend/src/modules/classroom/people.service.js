import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';

const USER = { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, isActive: true } };
const DEPT = { select: { id: true, name: true, code: true } };

async function assertClassroomRole(userId, role) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, system: true } });
  if (!user) throw new HttpError(404, 'User not found');
  if (user.system !== 'CLASSROOM' || user.role !== role) {
    throw new HttpError(422, `User must be a ${role} in the classroom system`);
  }
}

const nameSearch = (q) => ({
  user: {
    OR: [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { email: { contains: q } },
    ],
  },
});

// ─── Students ───
export async function createStudent(input) {
  await assertClassroomRole(input.userId, 'STUDENT_CLASSROOM');
  return prisma.studentProfile.create({
    data: input,
    include: { user: USER, department: DEPT, class: { select: { id: true, name: true } } },
  });
}

export function listStudents({ departmentId, classId, q }) {
  return prisma.studentProfile.findMany({
    where: { ...(departmentId && { departmentId }), ...(classId && { classId }), ...(q && nameSearch(q)) },
    include: { user: USER, department: DEPT, class: { select: { id: true, name: true } } },
    orderBy: { studentNo: 'asc' },
  });
}

export async function getStudent(userId) {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    include: { user: USER, department: DEPT, class: { select: { id: true, name: true, level: true, academicYear: true } } },
  });
  if (!profile) throw new HttpError(404, 'Student profile not found');
  return profile;
}

export async function updateStudent(userId, patch) {
  await getStudent(userId);
  return prisma.studentProfile.update({ where: { userId }, data: patch, include: { user: USER } });
}

// ─── Teachers ───
export async function createTeacher(input) {
  await assertClassroomRole(input.userId, 'TEACHER_CLASSROOM');
  return prisma.teacherProfile.create({ data: input, include: { user: USER, department: DEPT } });
}

export function listTeachers({ departmentId, q }) {
  return prisma.teacherProfile.findMany({
    where: { ...(departmentId && { departmentId }), ...(q && nameSearch(q)) },
    include: { user: USER, department: DEPT },
    orderBy: { staffNo: 'asc' },
  });
}

export async function getTeacher(userId) {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId },
    include: { user: USER, department: DEPT },
  });
  if (!profile) throw new HttpError(404, 'Teacher profile not found');
  return profile;
}

export async function updateTeacher(userId, patch) {
  await getTeacher(userId);
  return prisma.teacherProfile.update({ where: { userId }, data: patch, include: { user: USER } });
}
