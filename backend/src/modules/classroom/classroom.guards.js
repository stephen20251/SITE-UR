import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';

// ─── Role groups for the classroom subsystem ───
export const ROLES = {
  ADMIN: ['ADMIN'],
  MANAGE_STRUCTURE: ['ADMIN', 'SECRETARY', 'CHEF_DE_MENTION', 'PEDAGOGICAL_MANAGER'],
  APPROVE_TIMETABLE: ['ADMIN', 'CHEF_DE_MENTION', 'PEDAGOGICAL_MANAGER'],
  TEACH_OR_STAFF: ['TEACHER_CLASSROOM', 'ADMIN', 'SECRETARY', 'CHEF_DE_MENTION', 'PEDAGOGICAL_MANAGER'],
  TEACHER: ['TEACHER_CLASSROOM'],
  STUDENT: ['STUDENT_CLASSROOM'],
};

export async function getClassOrThrow(classId) {
  const klass = await prisma.classroomClass.findUnique({
    where: { id: classId },
    include: { department: { select: { id: true, name: true, code: true } } },
  });
  if (!klass) throw new HttpError(404, 'Class not found');
  return klass;
}

// User ids of the students enrolled in a class (Attendance/Grade reference User, not StudentProfile).
export async function studentUserIdsInClass(classId) {
  const students = await prisma.studentProfile.findMany({ where: { classId }, select: { userId: true } });
  return students.map((s) => s.userId);
}
