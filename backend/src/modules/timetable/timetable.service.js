import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { notifyUsers } from '../../utils/notify.js';
import { broadcast } from '../../realtime/events.js';
import { ROLES, getClassOrThrow, studentUserIdsInClass } from '../classroom/classroom.guards.js';

const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

async function assertNoOverlap(classId, dayOfWeek, startTime, endTime, excludeId) {
  const sameDay = await prisma.timetableEntry.findMany({
    where: { classId, dayOfWeek, status: { not: 'REJECTED' }, ...(excludeId && { id: { not: excludeId } }) },
    select: { startTime: true, endTime: true },
  });
  const s = toMinutes(startTime);
  const e = toMinutes(endTime);
  for (const x of sameDay) {
    if (s < toMinutes(x.endTime) && toMinutes(x.startTime) < e) {
      throw new HttpError(409, 'Time slot overlaps an existing entry for this class/day');
    }
  }
}

function assertEditable(entry, user) {
  if (!['DRAFT', 'REJECTED'].includes(entry.status)) {
    throw new HttpError(409, `Cannot edit a ${entry.status} entry`);
  }
  const isStaff = ROLES.MANAGE_STRUCTURE.includes(user.role);
  if (!isStaff && entry.createdById !== user.sub) {
    throw new HttpError(403, 'You can only edit your own draft entries');
  }
}

// ─── Entry CRUD ───
export async function createEntry(user, input) {
  await getClassOrThrow(input.classId);
  if (toMinutes(input.endTime) <= toMinutes(input.startTime)) {
    throw new HttpError(422, 'endTime must be after startTime');
  }
  await assertNoOverlap(input.classId, input.dayOfWeek, input.startTime, input.endTime, null);
  return prisma.timetableEntry.create({
    data: {
      classId: input.classId,
      subject: input.subject,
      teacherId: input.teacherId ?? user.sub,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      room: input.room,
      status: 'DRAFT',
      createdById: user.sub,
    },
  });
}

export async function updateEntry(user, id, patch) {
  const entry = await prisma.timetableEntry.findUnique({ where: { id } });
  if (!entry) throw new HttpError(404, 'Entry not found');
  assertEditable(entry, user);

  const next = { ...entry, ...patch };
  if (toMinutes(next.endTime) <= toMinutes(next.startTime)) {
    throw new HttpError(422, 'endTime must be after startTime');
  }
  if (patch.dayOfWeek !== undefined || patch.startTime !== undefined || patch.endTime !== undefined) {
    await assertNoOverlap(entry.classId, next.dayOfWeek, next.startTime, next.endTime, id);
  }
  // editing a rejected entry sends it back to draft
  return prisma.timetableEntry.update({ where: { id }, data: { ...patch, status: 'DRAFT' } });
}

export async function deleteEntry(user, id) {
  const entry = await prisma.timetableEntry.findUnique({ where: { id } });
  if (!entry) throw new HttpError(404, 'Entry not found');
  assertEditable(entry, user);
  await prisma.timetableEntry.delete({ where: { id } });
}

// ─── Views ───
export async function classTimetable(user, classId, { status }) {
  await getClassOrThrow(classId);

  if (user.role === 'STUDENT_CLASSROOM') {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: user.sub }, select: { classId: true } });
    if (profile?.classId !== classId) throw new HttpError(403, 'You can only view your own class timetable');
    return prisma.timetableEntry.findMany({
      where: { classId, status: 'PUBLISHED' },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  return prisma.timetableEntry.findMany({
    where: { classId, ...(status && { status }) },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
}

// ─── Workflow ───
export async function submit(user, classId) {
  await getClassOrThrow(classId);
  const result = await prisma.timetableEntry.updateMany({
    where: { classId, status: { in: ['DRAFT', 'REJECTED'] } },
    data: { status: 'PENDING_APPROVAL' },
  });
  if (result.count === 0) throw new HttpError(409, 'No draft entries to submit');
  return { submitted: result.count, status: 'PENDING_APPROVAL' };
}

export async function approve(user, classId) {
  await getClassOrThrow(classId);
  const result = await prisma.timetableEntry.updateMany({
    where: { classId, status: 'PENDING_APPROVAL' },
    data: { status: 'APPROVED', approvedById: user.sub },
  });
  if (result.count === 0) throw new HttpError(409, 'No entries are pending approval');
  return { approved: result.count, status: 'APPROVED' };
}

export async function reject(user, classId, reason) {
  await getClassOrThrow(classId);
  const pending = await prisma.timetableEntry.findMany({
    where: { classId, status: 'PENDING_APPROVAL' },
    select: { createdById: true },
  });
  if (pending.length === 0) throw new HttpError(409, 'No entries are pending approval');

  await prisma.timetableEntry.updateMany({
    where: { classId, status: 'PENDING_APPROVAL' },
    data: { status: 'REJECTED', approvedById: user.sub },
  });

  const creators = [...new Set(pending.map((p) => p.createdById))];
  notifyUsers(creators, {
    type: 'GENERIC',
    title: 'Timetable changes requested',
    body: reason || 'Your submitted timetable was rejected and needs changes',
    data: { classId },
  }).catch(() => {});

  return { rejected: pending.length, status: 'REJECTED' };
}

export async function publish(user, classId) {
  const klass = await getClassOrThrow(classId);
  const result = await prisma.timetableEntry.updateMany({
    where: { classId, status: 'APPROVED' },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  });
  if (result.count === 0) throw new HttpError(409, 'No approved entries to publish');

  // Notify students in the class + assigned teachers.
  const studentIds = await studentUserIdsInClass(classId);
  const teacherRows = await prisma.timetableEntry.findMany({
    where: { classId, status: 'PUBLISHED', teacherId: { not: null } },
    select: { teacherId: true },
  });
  const recipients = [...new Set([...studentIds, ...teacherRows.map((t) => t.teacherId)])];

  notifyUsers(recipients, {
    type: 'TIMETABLE_PUBLISHED',
    title: 'Timetable published',
    body: `The timetable for ${klass.name} is now available`,
    data: { classId },
  }).catch(() => {});
  broadcast('timetable:published', { classId, name: klass.name });

  return { published: result.count, status: 'PUBLISHED' };
}
