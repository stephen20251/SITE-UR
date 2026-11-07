import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { getClassOrThrow, studentUserIdsInClass } from './classroom.guards.js';

const STUDENT = { select: { id: true, firstName: true, lastName: true } };
const dayStart = (d) => new Date(`${d}T00:00:00.000Z`);
const dayEnd = (d) => new Date(`${d}T23:59:59.999Z`);

// Bulk mark/update attendance for a class on a given day.
export async function mark(user, { classId, date, records }) {
  await getClassOrThrow(classId);
  const validIds = new Set(await studentUserIdsInClass(classId));
  const day = dayStart(date);

  const ops = records
    .filter((r) => validIds.has(r.studentId))
    .map((r) =>
      prisma.attendance.upsert({
        where: { classId_studentId_date: { classId, studentId: r.studentId, date: day } },
        create: { classId, studentId: r.studentId, date: day, status: r.status, note: r.note, markedById: user.sub },
        update: { status: r.status, note: r.note, markedById: user.sub },
      }),
    );

  if (ops.length === 0) throw new HttpError(422, 'No valid students for this class in the payload');
  const saved = await prisma.$transaction(ops);
  return { saved: saved.length, date };
}

export async function listForClass({ classId, date, from, to }) {
  await getClassOrThrow(classId);
  const where = { classId };
  if (date) where.date = dayStart(date);
  else if (from || to) where.date = { ...(from && { gte: dayStart(from) }), ...(to && { lte: dayEnd(to) }) };

  return prisma.attendance.findMany({
    where,
    include: { student: STUDENT },
    orderBy: [{ date: 'desc' }],
  });
}

export async function classSummary(classId) {
  await getClassOrThrow(classId);
  const [rows, students] = await Promise.all([
    prisma.attendance.findMany({ where: { classId }, select: { studentId: true, status: true } }),
    prisma.studentProfile.findMany({ where: { classId }, include: { user: STUDENT }, orderBy: { studentNo: 'asc' } }),
  ]);

  const byStudent = new Map();
  for (const r of rows) {
    const s = byStudent.get(r.studentId) ?? { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, total: 0 };
    s[r.status] += 1;
    s.total += 1;
    byStudent.set(r.studentId, s);
  }

  return students.map((sp) => {
    const s = byStudent.get(sp.userId) ?? { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, total: 0 };
    const presentRate = s.total ? Math.round(((s.PRESENT + s.LATE) / s.total) * 100) : 0;
    return { student: sp.user, ...s, presentRate };
  });
}
