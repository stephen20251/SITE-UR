import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { ROLES, getClassOrThrow, studentUserIdsInClass } from './classroom.guards.js';
import { notifyUsers } from '../../utils/notify.js';
import { broadcast } from '../../realtime/events.js';

const AUTHOR = { select: { id: true, firstName: true, lastName: true, role: true } };

export async function create(user, input) {
  // Only staff/admins may post globally; teachers are limited to their class.
  if (input.scope === 'GLOBAL' && !ROLES.MANAGE_STRUCTURE.includes(user.role)) {
    throw new HttpError(403, 'Only staff can post global announcements');
  }
  if (input.scope === 'CLASS') await getClassOrThrow(input.classId);

  const announcement = await prisma.announcement.create({
    data: {
      authorId: user.sub,
      title: input.title,
      body: input.body,
      scope: input.scope,
      classId: input.scope === 'CLASS' ? input.classId : null,
      system: 'CLASSROOM',
    },
    include: { author: AUTHOR },
  });

  // Fan-out notifications.
  let recipients = [];
  if (input.scope === 'GLOBAL') {
    const users = await prisma.user.findMany({
      where: { system: 'CLASSROOM', isActive: true, deletedAt: null, id: { not: user.sub } },
      select: { id: true },
    });
    recipients = users.map((u) => u.id);
  } else {
    recipients = await studentUserIdsInClass(input.classId);
  }

  notifyUsers(recipients, {
    type: 'ANNOUNCEMENT',
    title: input.title,
    body: input.body.slice(0, 140),
    data: { announcementId: announcement.id, scope: input.scope, classId: announcement.classId },
  }).catch(() => {});
  broadcast('announcement:new', { id: announcement.id, scope: announcement.scope, classId: announcement.classId, title: announcement.title });

  return announcement;
}

// Visible feed: staff/teachers see everything; students see GLOBAL + their class.
export async function listForUser(user) {
  if (ROLES.TEACH_OR_STAFF.includes(user.role)) {
    return prisma.announcement.findMany({
      where: { system: 'CLASSROOM' },
      include: { author: AUTHOR },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  const profile = await prisma.studentProfile.findUnique({ where: { userId: user.sub }, select: { classId: true } });
  return prisma.announcement.findMany({
    where: {
      system: 'CLASSROOM',
      OR: [{ scope: 'GLOBAL' }, ...(profile?.classId ? [{ scope: 'CLASS', classId: profile.classId }] : [])],
    },
    include: { author: AUTHOR },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function remove(user, id) {
  const announcement = await prisma.announcement.findUnique({ where: { id } });
  if (!announcement) throw new HttpError(404, 'Announcement not found');
  if (announcement.authorId !== user.sub && !ROLES.ADMIN.includes(user.role)) {
    throw new HttpError(403, 'You can only delete your own announcements');
  }
  await prisma.announcement.delete({ where: { id } });
}
