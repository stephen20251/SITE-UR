import { prisma } from '../../database/prisma.js';

// Schema uses isRead: Boolean (not readAt). We expose readAt in the response
// as a convention for the frontend by returning createdAt when read.
function shape(n) {
  return {
    ...n,
    readAt: n.isRead ? n.createdAt : null,
  };
}

export async function list(userId, { page, limit }) {
  const where = { userId };
  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { items: items.map(shape), total, unreadCount, page, limit };
}

export async function unreadCount(userId) {
  const count = await prisma.notification.count({ where: { userId, isRead: false } });
  return { count };
}

export async function markRead(userId, id) {
  const result = await prisma.notification.updateMany({
    where: { id, userId, isRead: false },
    data: { isRead: true },
  });
  return { updated: result.count };
}

export async function markAll(userId) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { updated: result.count };
}
