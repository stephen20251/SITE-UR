import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { ROLES, getClassOrThrow, studentUserIdsInClass } from './classroom.guards.js';
import { notifyUser } from '../../utils/notify.js';

const STUDENT = { select: { id: true, firstName: true, lastName: true } };
const TEACHER = { select: { id: true, firstName: true, lastName: true } };

export async function create(user, input) {
  await getClassOrThrow(input.classId);
  const validIds = new Set(await studentUserIdsInClass(input.classId));
  if (!validIds.has(input.studentId)) throw new HttpError(422, 'Student is not in this class');

  const grade = await prisma.grade.create({
    data: { ...input, teacherId: user.sub },
    include: { student: STUDENT, teacher: TEACHER },
  });

  notifyUser(input.studentId, {
    type: 'RESULTS_READY',
    title: 'New grade posted',
    body: `${input.subject} · ${input.assessment}: ${input.score}/${input.maxScore}`,
    data: { classId: input.classId, gradeId: grade.id },
  }).catch(() => {});

  return grade;
}

export function list({ classId, studentId, subject }) {
  return prisma.grade.findMany({
    where: { ...(classId && { classId }), ...(studentId && { studentId }), ...(subject && { subject }) },
    include: { student: STUDENT, teacher: TEACHER },
    orderBy: { createdAt: 'desc' },
  });
}

export async function remove(user, id) {
  const grade = await prisma.grade.findUnique({ where: { id } });
  if (!grade) throw new HttpError(404, 'Grade not found');
  const isAdmin = ROLES.ADMIN.includes(user.role);
  if (grade.teacherId !== user.sub && !isAdmin) throw new HttpError(403, 'You can only delete grades you posted');
  await prisma.grade.delete({ where: { id } });
}

// Per-student weighted average (normalised to a percentage).
export async function gradebook(classId) {
  await getClassOrThrow(classId);
  const [grades, students] = await Promise.all([
    prisma.grade.findMany({ where: { classId }, orderBy: { createdAt: 'asc' } }),
    prisma.studentProfile.findMany({ where: { classId }, include: { user: STUDENT }, orderBy: { studentNo: 'asc' } }),
  ]);

  const byStudent = new Map();
  for (const g of grades) {
    const arr = byStudent.get(g.studentId) ?? [];
    arr.push(g);
    byStudent.set(g.studentId, arr);
  }

  return students.map((sp) => {
    const list = byStudent.get(sp.userId) ?? [];
    const totalWeight = list.reduce((s, g) => s + g.weight, 0);
    const weightedPct = totalWeight
      ? Math.round((list.reduce((s, g) => s + (g.score / g.maxScore) * g.weight, 0) / totalWeight) * 1000) / 10
      : null;
    return {
      student: sp.user,
      grades: list.map((g) => ({ id: g.id, subject: g.subject, assessment: g.assessment, score: g.score, maxScore: g.maxScore, weight: g.weight })),
      average: weightedPct, // percentage, or null if no grades
    };
  });
}
