// In-memory presence registry: userId → live connection count.
// A user may have several sockets (tabs/devices); they go "offline" only when
// the last one disconnects. Single-process; swap for Redis to scale horizontally.
const connectionCounts = new Map();

export function addPresence(userId) {
  const next = (connectionCounts.get(userId) ?? 0) + 1;
  connectionCounts.set(userId, next);
  return next; // 1 ⇒ just came online
}

export function removePresence(userId) {
  const next = (connectionCounts.get(userId) ?? 1) - 1;
  if (next <= 0) {
    connectionCounts.delete(userId);
    return 0; // 0 ⇒ went offline
  }
  connectionCounts.set(userId, next);
  return next;
}

export const isOnline = (userId) => connectionCounts.has(userId);
export const onlineUserIds = () => [...connectionCounts.keys()];
