/**
 * ERP-specific chat operations.
 * General room/message logic lives in chat.service.js.
 * This file adds: ERP room bootstrap, search, pin, system messages, file attachments.
 */
import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { emitToRoom, emitToUser } from '../../realtime/events.js';
import { allowedContactIds, canContact } from './contact-rules.js';
import { displayRoleName } from '../../utils/roles.js';

const USER_CARD = { id: true, firstName: true, lastName: true, avatarUrl: true, systemRole: true };

// ── Room cards ─────────────────────────────────────────────────────────────
async function roomCard(room, viewerId) {
  const me = room.members.find((m) => m.userId === viewerId);
  const since = me?.lastReadAt ?? me?.joinedAt ?? new Date(0);
  const unread = await prisma.message.count({
    where: { roomId: room.id, senderId: { not: viewerId }, createdAt: { gt: since } },
  });
  const last = room.messages?.[0] ?? null;
  const other = room.isPrivate ? room.members.find((m) => m.userId !== viewerId)?.user : null;

  return {
    id: room.id,
    name: other ? `${other.firstName} ${other.lastName}` : (room.name ?? 'Sans nom'),
    type: room.type,
    isPrivate: room.isPrivate,
    system: room.system,
    members: room.members.map((m) => ({ ...m.user, role: m.role })),
    otherUser: other ?? null,
    unread,
    lastMessage: last ? { body: last.body, createdAt: last.createdAt, senderId: last.senderId, isSystem: last.isSystem } : null,
    updatedAt: last?.createdAt ?? room.createdAt,
  };
}

async function loadCard(roomId, viewerId) {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: {
      members: { include: { user: { select: USER_CARD } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!room) throw new HttpError(404, 'Room not found');
  return roomCard(room, viewerId);
}

// ── List ERP rooms for the calling user ────────────────────────────────────
export async function listErpRooms(userId) {
  const memberships = await prisma.chatRoomMember.findMany({
    where: { userId, room: { system: 'ERP' } },
    include: {
      room: {
        include: {
          members: { include: { user: { select: USER_CARD } } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  });
  const cards = await Promise.all(memberships.map((m) => roomCard(m.room, userId)));
  return cards.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

// ── Private DM ─────────────────────────────────────────────────────────────
export async function getOrCreateDM(userId, otherUserId) {
  if (userId === otherUserId) throw new HttpError(400, 'Cannot open DM with yourself');
  const other = await prisma.user.findUnique({ where: { id: otherUserId }, select: { id: true } });
  if (!other) throw new HttpError(404, 'User not found');
  if (!(await canContact(userId, otherUserId))) {
    throw new HttpError(403, "Vous n'êtes pas autorisé à contacter cette personne");
  }

  let room = await prisma.chatRoom.findFirst({
    where: { isPrivate: true, system: 'ERP', AND: [{ members: { some: { userId } } }, { members: { some: { userId: otherUserId } } }] },
  });
  if (!room) {
    room = await prisma.chatRoom.create({
      data: {
        name: '', isPrivate: true, type: 'PRIVATE', system: 'ERP',
        members: { create: [{ userId, role: 'MEMBER', lastReadAt: new Date() }, { userId: otherUserId, role: 'MEMBER' }] },
      },
    });
  }
  return loadCard(room.id, userId);
}

// ── Get or create a class/group room (auto-populated with promotion members) ─
export async function getOrCreateClassRoom(userId, promotionId, groupId) {
  const key = groupId ?? promotionId;
  let room = await prisma.chatRoom.findFirst({
    where: { system: 'ERP', type: 'CLASS', name: { contains: key } },
  });
  if (!room) {
    // Resolve members: students of the promotion (or group)
    const promotion = await prisma.promotion.findUnique({
      where: { id: promotionId },
      include: {
        students: { select: { userId: true } },
        teachers: { include: { teacher: { select: { userId: true } } } },
        groups: groupId ? { where: { id: groupId }, include: { students: { select: { userId: true } } } } : false,
      },
    });
    if (!promotion) throw new HttpError(404, 'Promotion not found');

    const studentIds = groupId
      ? (promotion.groups[0]?.students.map((s) => s.userId) ?? [])
      : promotion.students.map((s) => s.userId);
    const teacherIds = promotion.teachers?.map((t) => t.teacher?.userId).filter(Boolean) ?? [];
    const allIds = [...new Set([...studentIds, ...teacherIds])];

    room = await prisma.chatRoom.create({
      data: {
        name: groupId ? `Groupe ${promotion.name}` : promotion.name,
        isGroup: true, type: 'CLASS', system: 'ERP',
        members: { create: allIds.map((uid) => ({ userId: uid, role: studentIds.includes(uid) ? 'MEMBER' : 'ADMIN' })) },
      },
    });
  }
  // Ensure caller is a member
  await prisma.chatRoomMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId } },
    create: { roomId: room.id, userId, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });
  return loadCard(room.id, userId);
}

// ── Admin broadcast room (all staff + teachers of a mention) ────────────────
export async function getOrCreateAdminRoom(userId, name, memberIds) {
  let room = await prisma.chatRoom.create({
    data: {
      name, isGroup: true, type: 'ADMIN', system: 'ERP',
      members: {
        create: [...new Set([userId, ...memberIds])].map((uid) => ({
          userId: uid, role: uid === userId ? 'ADMIN' : 'MEMBER',
        })),
      },
    },
  });
  return loadCard(room.id, userId);
}

// ── Messages ────────────────────────────────────────────────────────────────
export async function getMessages(userId, roomId, { limit = 50, before } = {}) {
  await assertMember(roomId, userId);
  const messages = await prisma.message.findMany({
    where: { roomId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: Number(limit),
    include: { sender: { select: USER_CARD } },
  });
  await markRead(userId, roomId);
  return messages.reverse();
}

export async function sendMessage(senderId, roomId, { body, fileUrl, fileType, fileName } = {}) {
  await assertMember(roomId, senderId);
  const text = String(body ?? '').trim();
  if (!text && !fileUrl) throw new HttpError(400, 'Message vide');
  if (text.length > 4000) throw new HttpError(422, 'Message trop long');

  const message = await prisma.message.create({
    data: { roomId, senderId, body: text || (fileName ?? 'Fichier'), fileUrl, fileType, fileName },
    include: { sender: { select: USER_CARD } },
  });

  emitToRoom(`room:${roomId}`, 'chat:message', message);

  const others = await prisma.chatRoomMember.findMany({ where: { roomId, userId: { not: senderId } }, select: { userId: true } });
  for (const m of others) {
    emitToUser(m.userId, 'chat:notify', { roomId, preview: (text || fileName).slice(0, 80), sender: message.sender });
  }

  await markRead(senderId, roomId);
  return message;
}

export async function sendSystemMessage(roomId, body) {
  const sysUser = await prisma.user.findFirst({ where: { systemRole: 'SUPER_ADMIN' }, select: { id: true } });
  if (!sysUser) return;
  const message = await prisma.message.create({
    data: { roomId, senderId: sysUser.id, body, isSystem: true },
    include: { sender: { select: USER_CARD } },
  });
  emitToRoom(`room:${roomId}`, 'chat:message', message);
}

// ── Pin / unpin ─────────────────────────────────────────────────────────────
export async function togglePin(userId, messageId) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw new HttpError(404, 'Message not found');
  await assertMember(msg.roomId, userId);
  const updated = await prisma.message.update({ where: { id: messageId }, data: { isPinned: !msg.isPinned } });
  emitToRoom(`room:${msg.roomId}`, 'chat:pin', { messageId, isPinned: updated.isPinned });
  return updated;
}

export async function getPinned(userId, roomId) {
  await assertMember(roomId, userId);
  return prisma.message.findMany({ where: { roomId, isPinned: true }, include: { sender: { select: USER_CARD } }, orderBy: { createdAt: 'desc' } });
}

// ── Search ──────────────────────────────────────────────────────────────────
export async function searchMessages(userId, roomId, q) {
  await assertMember(roomId, userId);
  if (!q || q.trim().length < 2) return [];
  return prisma.message.findMany({
    where: { roomId, body: { contains: q } },
    include: { sender: { select: USER_CARD } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

// ── Read receipt ─────────────────────────────────────────────────────────────
export async function markRead(userId, roomId) {
  await prisma.chatRoomMember.updateMany({ where: { roomId, userId }, data: { lastReadAt: new Date() } });
  return { ok: true };
}

// ── Helpers ─────────────────────────────────────────────────────────────────
async function assertMember(roomId, userId) {
  const m = await prisma.chatRoomMember.findUnique({ where: { roomId_userId: { roomId, userId } } });
  if (!m) throw new HttpError(403, 'Not a member of this room');
  return m;
}

// ── ERP Contacts (role-aware contact list for starting DMs) ───────────────────
export async function listErpContacts(userId, q = '') {
  const candidateIds = await allowedContactIds(userId);

  // Remove self
  candidateIds.delete(userId);

  // Load user cards with optional search filter
  const where = {
    id: { in: [...candidateIds] },
    isActive: true,
    ...(q ? {
      OR: [
        { firstName: { contains: q } },
        { lastName:  { contains: q } },
        { email:     { contains: q } },
        { studentProfile: { matricule: { contains: q } } },
      ],
    } : {}),
  };

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true, firstName: true, lastName: true, avatarUrl: true, systemRole: true,
      studentProfile: { select: { matricule: true, promotion: { select: { name: true, level: true } }, mention: { select: { name: true } } } },
      teacherProfile: { select: { specialization: true, mention: { select: { name: true } } } },
      staffProfile:   { select: { employeeId: true } },
      userRoles:      { select: { role: { select: { name: true } } }, take: 1 },
    },
    take: 100,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  return users.map((u) => {
    let subtitle = '';
    let group = '';
    if (u.systemRole === 'STUDENT') {
      const sp = u.studentProfile;
      subtitle = [sp?.promotion?.level, sp?.mention?.name].filter(Boolean).join(' · ');
      group = 'Étudiants';
      if (sp?.matricule) subtitle += sp.matricule ? ` — ${sp.matricule}` : '';
    } else if (u.systemRole === 'TEACHER') {
      subtitle = u.teacherProfile?.specialization ?? u.teacherProfile?.mention?.name ?? 'Enseignant';
      group = 'Enseignants';
    } else if (u.systemRole === 'PARENT') {
      subtitle = 'Parent';
      group = 'Parents';
    } else if (u.systemRole === 'SUPER_ADMIN') {
      subtitle = 'Administrateur';
      group = 'Administration';
    } else {
      subtitle = displayRoleName(u.userRoles[0]?.role?.name) || u.systemRole;
      group = 'Personnel';
    }
    return { id: u.id, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.avatarUrl, systemRole: u.systemRole, subtitle, group };
  });
}
