// Rappels de retard d'écolage — notification individuelle à l'étudiant concerné
// et à ses parents. Un mois est « en retard » lorsqu'il est antérieur au mois en
// cours de l'année universitaire et n'est ni validé ni en attente de validation.
// Au plus un rappel par étudiant et par mois en retard tous les 7 jours.
import { prisma } from '../database/prisma.js';
import { notifyUser, notifyUsers } from '../utils/notify.js';

const RE_REMIND_DAYS = 7;

async function currentCursusMonth() {
  const year = await prisma.academicYear.findFirst({ where: { isCurrent: true }, orderBy: { startDate: 'desc' } });
  if (!year) return null;
  const now = new Date();
  if (now > year.endDate || now < year.startDate) return null;
  const m = (now.getFullYear() - year.startDate.getFullYear()) * 12 + (now.getMonth() - year.startDate.getMonth()) + 1;
  return Math.min(8, Math.max(1, m));
}

export async function sendTuitionLateReminders() {
  const current = await currentCursusMonth();
  if (!current || current <= 1) return { sent: 0 };
  const since = new Date(Date.now() - RE_REMIND_DAYS * 86_400_000);

  const students = await prisma.studentProfile.findMany({
    where: { status: 'ACTIVE', user: { isActive: true } },
    select: {
      id: true, userId: true, promotion: { select: { level: true } },
      user: { select: { firstName: true, lastName: true } },
      parentLinks: { select: { parent: { select: { userId: true } } } },
      tuitionPayments: { where: { status: { in: ['VALIDATED', 'PENDING'] } }, select: { month: true, level: true } },
    },
  });

  let sent = 0;
  for (const s of students) {
    const level = s.promotion?.level;
    const covered = new Set(s.tuitionPayments.filter((p) => !level || p.level === level).map((p) => p.month));
    const late = [];
    for (let m = 1; m < current; m++) if (!covered.has(m)) late.push(m);
    if (!late.length) continue;

    const title = `Retard d'écolage — mois ${late.join(', ')}`;
    const already = await prisma.notification.findFirst({
      where: { userId: s.userId, title, createdAt: { gt: since } },
      select: { id: true },
    });
    if (already) continue;

    await notifyUser(s.userId, {
      type: 'WARNING', title,
      body: `Votre écolage n'est pas à jour (${late.length} mois). Réglez-le en ligne (MVola) ou au bureau du secrétariat.`,
      link: '/classroom/finance',
    });
    const parents = s.parentLinks.map((l) => l.parent.userId);
    if (parents.length) {
      await notifyUsers(parents, {
        type: 'WARNING',
        title: `Retard d'écolage de ${s.user.firstName} — mois ${late.join(', ')}`,
        body: `L'écolage de ${s.user.firstName} ${s.user.lastName} n'est pas à jour (${late.length} mois).`,
        link: '/classroom/finance',
      });
    }
    sent++;
  }
  return { sent };
}

export function startTuitionReminderJob() {
  const DAY = 24 * 60 * 60 * 1000;
  setTimeout(() => sendTuitionLateReminders().catch((e) => console.error('[tuition-reminders]', e)), 3 * 60 * 1000);
  setInterval(() => sendTuitionLateReminders().catch((e) => console.error('[tuition-reminders]', e)), DAY);
  console.log('⏰ tuition late reminder job armed (24h interval)');
}
