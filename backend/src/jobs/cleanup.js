// Storage retention — keeps the database and disk from filling up.
//
// Policy (configurable via env):
//  - chat messages      → deleted after RETENTION_MESSAGES_DAYS (default 30),
//    pinned messages are kept; attached files are removed from disk too.
//  - notifications      → read ones after RETENTION_NOTIF_DAYS (default 30),
//    everything after 90 days (even unread).
//  - learning activity  → after 90 days (streak/stats only look back 60 days).
//  - email log files    → after 30 days (dev fallback files).
//
// Runs daily (armed at boot) + manual trigger: POST /lms-admin/cleanup.
import fs from 'fs';
import path from 'path';
import { prisma } from '../database/prisma.js';

const MSG_DAYS = Number(process.env.RETENTION_MESSAGES_DAYS || 30);
const NOTIF_DAYS = Number(process.env.RETENTION_NOTIF_DAYS || 30);
const HARD_DAYS = 90;

const ago = (days) => new Date(Date.now() - days * 86_400_000);

function safeUnlinkUpload(fileUrl) {
  // Only ever touch files inside the local uploads directory.
  if (!fileUrl || !fileUrl.startsWith('/uploads/')) return false;
  const abs = path.resolve('.' + fileUrl);
  if (!abs.startsWith(path.resolve('uploads'))) return false;
  try { fs.unlinkSync(abs); return true; } catch { return false; }
}

export async function runRetentionCleanup() {
  const report = { messages: 0, files: 0, notifications: 0, activities: 0, emailLogs: 0 };

  // 1. Chat messages older than the window (pinned ones survive) + their files.
  const oldMessages = await prisma.message.findMany({
    where: { createdAt: { lt: ago(MSG_DAYS) }, isPinned: false },
    select: { id: true, fileUrl: true },
  });
  for (const m of oldMessages) {
    if (m.fileUrl && safeUnlinkUpload(m.fileUrl)) report.files += 1;
  }
  if (oldMessages.length) {
    const del = await prisma.message.deleteMany({
      where: { id: { in: oldMessages.map((m) => m.id) } },
    });
    report.messages = del.count;
  }

  // 2. Notifications: read > NOTIF_DAYS, everything > HARD_DAYS.
  const n1 = await prisma.notification.deleteMany({
    where: { isRead: true, createdAt: { lt: ago(NOTIF_DAYS) } },
  });
  const n2 = await prisma.notification.deleteMany({
    where: { createdAt: { lt: ago(HARD_DAYS) } },
  });
  report.notifications = n1.count + n2.count;

  // 3. Learning activity beyond every stats window.
  const a = await prisma.learningActivity.deleteMany({
    where: { createdAt: { lt: ago(HARD_DAYS) } },
  });
  report.activities = a.count;

  // 4. Dev email files.
  const dir = path.resolve('logs/emails');
  if (fs.existsSync(dir)) {
    const cutoff = Date.now() - 30 * 86_400_000;
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      try {
        if (fs.statSync(p).mtimeMs < cutoff) { fs.unlinkSync(p); report.emailLogs += 1; }
      } catch { /* ignore */ }
    }
  }

  console.log(
    `🧹 rétention: ${report.messages} message(s), ${report.files} fichier(s) joint(s), ` +
    `${report.notifications} notification(s), ${report.activities} activité(s), ${report.emailLogs} log(s) e-mail supprimés`
  );
  return report;
}

// Boot-time scheduler (called once from server.js).
export function startCleanupJob() {
  const DAY = 24 * 60 * 60 * 1000;
  setTimeout(() => runRetentionCleanup().catch(() => {}), 5 * 60 * 1000);
  setInterval(() => runRetentionCleanup().catch(() => {}), DAY);
  console.log(`🧹 retention job armed (messages ${MSG_DAYS}j, notifications ${NOTIF_DAYS}j, purge dure ${HARD_DAYS}j)`);
}
