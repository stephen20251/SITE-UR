import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';

export async function myProfile(user) {
  if (user.systemRole === 'STUDENT') {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: user.sub },
      include: {
        promotion: { select: { id: true, name: true, level: true } },
        group:     { select: { id: true, name: true } },
        mention:   { select: { id: true, name: true } },
      },
    });
    return { kind: 'student', profile };
  }
  if (user.systemRole === 'TEACHER') {
    const profile = await prisma.teacherProfile.findUnique({ where: { userId: user.sub } });
    return { kind: 'teacher', profile };
  }
  return { kind: 'staff', profile: null };
}

export async function myClass(user) {
  const sp = await prisma.studentProfile.findUnique({
    where: { userId: user.sub },
    include: {
      promotion: { select: { id: true, name: true, level: true } },
      group:     { select: { id: true, name: true } },
      mention:   { select: { id: true, name: true } },
    },
  });
  if (!sp) throw new HttpError(404, 'Student profile not found');
  return sp;
}

export async function myTimetable() {
  // Timetable is served via /api/schedule/my-schedule
  return [];
}

export async function myAttendance(user) {
  const sp = await prisma.studentProfile.findUnique({ where: { userId: user.sub }, select: { id: true } });
  if (!sp) return [];
  return prisma.attendance.findMany({
    where: { studentId: sp.id },
    orderBy: { date: 'desc' },
    take: 200,
  });
}

export async function myGrades(user) {
  const sp = await prisma.studentProfile.findUnique({ where: { userId: user.sub }, select: { id: true } });
  if (!sp) return [];
  return prisma.grade.findMany({
    where: { studentId: sp.id },
    orderBy: { createdAt: 'desc' },
    include: { subject: { select: { id: true, name: true, code: true, credits: true } } },
  });
}

// ─── Parent ───

export async function myChildren(user) {
  const parent = await prisma.parentProfile.findUnique({ where: { userId: user.sub } });
  if (!parent) return [];

  const links = await prisma.parentLink.findMany({
    where: { parentId: parent.id },
    include: {
      student: {
        include: {
          user:      { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
          promotion: { select: { id: true, name: true, level: true } },
          mention:   { select: { id: true, name: true } },
          group:     { select: { id: true, name: true } },
        },
      },
    },
  });

  return links.map((l) => ({
    id: l.student.id,
    ...l.student.user,
    studentProfile: {
      id:        l.student.id,
      matricule: l.student.matricule,
      promotion: l.student.promotion,
      mention:   l.student.mention,
      group:     l.student.group,
    },
  }));
}

export async function childGrades(user, childId) {
  await assertParentOf(user, childId);
  return prisma.grade.findMany({
    where: { studentId: childId },
    orderBy: { createdAt: 'desc' },
    include: { subject: { select: { id: true, name: true, code: true, credits: true } } },
  });
}

export async function childAttendance(user, childId) {
  await assertParentOf(user, childId);
  return prisma.attendance.findMany({
    where: { studentId: childId },
    orderBy: { date: 'desc' },
    take: 200,
  });
}

async function assertParentOf(user, studentId) {
  const parent = await prisma.parentProfile.findUnique({ where: { userId: user.sub } });
  if (!parent) throw new HttpError(403, 'Parent profile not found');
  const link = await prisma.parentLink.findUnique({
    where: { parentId_studentId: { parentId: parent.id, studentId } },
  });
  if (!link) throw new HttpError(403, 'Not linked to this student');
}
