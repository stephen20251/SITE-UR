import { prisma } from '../../database/prisma.js';

export async function overview() {
  const [departments, classes, students, teachers, published, pending, attendanceRows] = await Promise.all([
    prisma.department.count(),
    prisma.classroomClass.count(),
    prisma.studentProfile.count(),
    prisma.teacherProfile.count(),
    prisma.timetableEntry.count({ where: { status: 'PUBLISHED' } }),
    prisma.timetableEntry.count({ where: { status: 'PENDING_APPROVAL' } }),
    prisma.attendance.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const att = Object.fromEntries(attendanceRows.map((r) => [r.status, r._count._all]));
  const total = Object.values(att).reduce((s, n) => s + n, 0);
  const presentRate = total ? Math.round((((att.PRESENT || 0) + (att.LATE || 0)) / total) * 100) : 0;

  return {
    departments,
    classes,
    students,
    teachers,
    timetable: { published, pendingApproval: pending },
    attendance: { present: att.PRESENT || 0, absent: att.ABSENT || 0, late: att.LATE || 0, excused: att.EXCUSED || 0, total, presentRate },
  };
}
