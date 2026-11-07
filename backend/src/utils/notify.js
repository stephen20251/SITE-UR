import { prisma } from '../database/prisma.js';
import { emitToUser } from '../realtime/events.js';

// Persist one notification and best-effort push it over Socket.io.
// The persisted row is the source of truth; the socket emit is a live nudge.
export async function notifyUser(userId, { type, title, body = null, link = null, data = null }) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body: body ?? '', link: link ?? null },
  });
  emitToUser(userId, 'notification', notification);
  return notification;
}

// Bulk notify many users (e.g. every enrolled student when a quiz is published).
export async function notifyUsers(userIds, { type, title, body = null, link = null, data = null }) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return { count: 0 };

  const result = await prisma.notification.createMany({
    data: ids.map((userId) => ({ userId, type, title, body: body ?? '', link: link ?? null })),
  });
  for (const userId of ids) {
    emitToUser(userId, 'notification', { type, title, body, link });
  }
  return result;
}
