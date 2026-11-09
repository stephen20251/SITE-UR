import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { emitToRoom, emitToUser } from '../../realtime/events.js';

const USER_CARD = { id: true, firstName: true, lastName: true, avatarUrl: true, systemRole: true };

// Map a Prisma user row to the shape the frontend expects (role = systemRole alias)
function shapeUser(u) {
  if (!u) return null;
  return { id: u.id, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.avatarUrl ?? null, role: u.systemRole };
}

const shapeMessage = (m) => ({
  id: m.id,
  roomId: m.roomId,
  senderId: m.senderId,
  body: m.body,
  fileUrl: m.fileUrl ?? null,
  fileType: m.fileType ?? null,
  fileName: m.fileName ?? null,
  isSystem: m.isSystem ?? false,
  createdAt: m.createdAt,
  sender: shapeUser(m.sender),
});

// ─── Membership ───
export async function assertMember(roomId, userId) {
  const membership = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  if (!membership) throw new HttpError(403, 'You are not a member of this room');
  return membership;
}

async function ensureMembership(roomId, userId) {
  await prisma.chatRoomMember.upsert({
    where: { roomId_userId: { roomId, userId } },
    create: { roomId, userId, lastReadAt: new Date() },
    update: {},
  });
}

// ─── Room cards (viewer-relative shape + unread count) ───
async function loadRoomCard(roomId, viewerId) {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: {
      members: { include: { user: { select: USER_CARD } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!room) throw new HttpError(404, 'Room not found');

  const me = room.members.find((m) => m.userId === viewerId);
  const since = me?.lastReadAt ?? me?.joinedAt ?? new Date(0);
  const unread = await prisma.message.count({
    where: { roomId, senderId: { not: viewerId }, createdAt: { gt: since } },
  });
  const otherRaw = room.isPrivate ? room.members.find((m) => m.userId !== viewerId)?.user : null;
  const other = otherRaw ? shapeUser(otherRaw) : null;
  const last = room.messages[0];

  return {
    id: room.id,
    type: room.courseId ? 'COURSE' : room.isPrivate ? 'PRIVATE' : 'GROUP',
    name: other ? `${other.firstName} ${other.lastName}` : (room.name ?? ''),
    isPrivate: room.isPrivate,
    courseId: room.courseId,
    otherUser: other ?? null,
    members: room.members.map((m) => shapeUser(m.user)),
    lastMessage: last ? { body: last.body, createdAt: last.createdAt, senderId: last.senderId } : null,
    unread,
    updatedAt: last?.createdAt ?? room.createdAt,
  };
}

export async function listRooms(userId) {
  const memberships = await prisma.chatRoomMember.findMany({
    where: { userId },
    select: { roomId: true },
  });
  const cards = await Promise.all(memberships.map((m) => loadRoomCard(m.roomId, userId)));
  return cards.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

// ─── Get-or-create rooms ───
export async function getOrCreateCourseRoom(userId, courseId) {
  const course = await prisma.onlineCourse.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, teacherId: true },
  });
  if (!course) throw new HttpError(404, 'Course not found');

  if (course.teacherId !== userId) {
    const enrolled = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: userId, courseId } },
    });
    if (!enrolled) throw new HttpError(403, 'Enroll in the course to access its chat');
  }

  let room = await prisma.chatRoom.findFirst({ where: { courseId } });
  if (!room) {
    room = await prisma.chatRoom.create({
      data: { name: course.title, system: 'ONLINE', courseId, isPrivate: false },
    });
  }
  await ensureMembership(room.id, userId);
  return loadRoomCard(room.id, userId);
}

export async function getOrCreatePrivateRoom(userId, otherUserId) {
  if (userId === otherUserId) throw new HttpError(400, 'Cannot open a chat with yourself');
  const other = await prisma.user.findUnique({
    where: { id: otherUserId },
    select: { id: true, systemRole: true },
  });
  if (!other) throw new HttpError(404, 'User not found');

  const system = ['STUDENT_ONLINE', 'TEACHER_ONLINE'].includes(other.systemRole) ? 'ONLINE' : 'ERP';

  let room = await prisma.chatRoom.findFirst({
    where: {
      isPrivate: true,
      AND: [{ members: { some: { userId } } }, { members: { some: { userId: otherUserId } } }],
    },
  });
  if (!room) {
    room = await prisma.chatRoom.create({
      data: {
        name: '',
        isPrivate: true,
        system,
        members: { create: [{ userId, lastReadAt: new Date() }, { userId: otherUserId }] },
      },
    });
  } else {
    await ensureMembership(room.id, userId);
  }
  return loadRoomCard(room.id, userId);
}

// ─── Messages ───
export async function getMessages(userId, roomId, { limit = 50, before } = {}) {
  await assertMember(roomId, userId);
  const messages = await prisma.message.findMany({
    where: { roomId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { sender: { select: USER_CARD } },
  });
  // opening a room marks it read up to now
  await markRead(userId, roomId);
  return messages.reverse().map(shapeMessage);
}

export async function sendMessage(senderId, roomId, body, fileUrl, fileType, fileName) {
  await assertMember(roomId, senderId);
  const text = String(body ?? '').trim();
  if (!text && !fileUrl) throw new HttpError(400, 'Message cannot be empty');
  if (text.length > 4000) throw new HttpError(422, 'Message too long');

  const message = await prisma.message.create({
    data: { roomId, senderId, body: text || (fileName ?? 'Fichier'), fileUrl: fileUrl ?? null, fileType: fileType ?? null, fileName: fileName ?? null },
    include: { sender: { select: USER_CARD } },
  });
  const shaped = shapeMessage(message);

  emitToRoom(`room:${roomId}`, 'chat:message', shaped);

  const others = await prisma.chatRoomMember.findMany({
    where: { roomId, userId: { not: senderId } },
    select: { userId: true },
  });
  const preview = fileUrl ? `📎 ${fileName ?? 'Fichier'}` : text.slice(0, 80);
  for (const m of others) {
    emitToUser(m.userId, 'chat:notify', { roomId, preview, sender: shaped.sender });
  }

  await markRead(senderId, roomId);
  return shaped;
}

// ─── LMS contact list (role-aware) ───
export async function lmsContactList(userId, q = '') {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, systemRole: true } });
  if (!me) throw new HttpError(404, 'User not found');

  const candidateIds = new Set();

  if (me.systemRole === 'STUDENT_ONLINE') {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: userId },
      select: { course: { select: { teacherId: true } } },
    });
    enrollments.forEach(e => candidateIds.add(e.course.teacherId));
    const admins = await prisma.user.findMany({ where: { systemRole: 'SUPER_ADMIN' }, select: { id: true } });
    admins.forEach(a => candidateIds.add(a.id));

  } else if (me.systemRole === 'TEACHER_ONLINE') {
    const courses = await prisma.onlineCourse.findMany({ where: { teacherId: userId }, select: { id: true } });
    const courseIds = courses.map(c => c.id);
    if (courseIds.length > 0) {
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId: { in: courseIds } },
        select: { studentId: true },
      });
      enrollments.forEach(e => candidateIds.add(e.studentId));
    }
    const peers = await prisma.user.findMany({ where: { systemRole: 'TEACHER_ONLINE', id: { not: userId } }, select: { id: true } });
    peers.forEach(p => candidateIds.add(p.id));
    const admins = await prisma.user.findMany({ where: { systemRole: 'SUPER_ADMIN' }, select: { id: true } });
    admins.forEach(a => candidateIds.add(a.id));

  } else {
    // SUPER_ADMIN — tout le monde LMS
    const all = await prisma.user.findMany({
      where: { systemRole: { in: ['STUDENT_ONLINE', 'TEACHER_ONLINE'] }, isActive: true },
      select: { id: true },
    });
    all.forEach(u => candidateIds.add(u.id));
  }

  candidateIds.delete(userId);
  if (candidateIds.size === 0) return [];

  const where = {
    id: { in: [...candidateIds] },
    isActive: true,
    ...(q.trim() ? {
      OR: [
        { firstName: { contains: q } },
        { lastName:  { contains: q } },
        { email:     { contains: q } },
      ],
    } : {}),
  };

  const users = await prisma.user.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, avatarUrl: true, systemRole: true },
    take: 60,
    orderBy: [{ systemRole: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
  });

  const ROLE_LABEL = { STUDENT_ONLINE: 'Étudiant(e)', TEACHER_ONLINE: 'Enseignant(e)', SUPER_ADMIN: 'Administrateur LMS' };
  return users.map(u => ({ ...u, roleLabel: ROLE_LABEL[u.systemRole] ?? u.systemRole }));
}

export async function markRead(userId, roomId) {
  await prisma.chatRoomMember
    .update({ where: { roomId_userId: { roomId, userId } }, data: { lastReadAt: new Date() } })
    .catch(() => {});
  return { ok: true };
}
