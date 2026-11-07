// "Come back to your course" reminder emails.
//
// A student gets at most one reminder per RE_REMIND_DAYS, and only when their
// enrollment is unfinished and untouched for INACTIVE_DAYS. The job runs every
// 12h (restart-safe: the per-enrollment lastReminderAt guard makes re-runs
// harmless) and can be triggered manually from the admin API.
import { prisma } from '../database/prisma.js';
import { sendEmail, renderEmail } from '../utils/mailer.js';

const INACTIVE_DAYS = 7;   // no visit for a week → candidate
const RE_REMIND_DAYS = 7;  // wait a week before reminding the same enrollment again
const BATCH = 50;          // safety cap per run

export async function sendCourseReminders() {
  const now = Date.now();
  const inactiveBefore = new Date(now - INACTIVE_DAYS * 86_400_000);
  const remindedBefore = new Date(now - RE_REMIND_DAYS * 86_400_000);

  const enrollments = await prisma.enrollment.findMany({
    where: {
      completedAt: null,
      progress: { lt: 100 },
      OR: [
        { lastVisitedAt: { lt: inactiveBefore } },
        { lastVisitedAt: null, createdAt: { lt: inactiveBefore } },
      ],
      AND: [
        { OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: remindedBefore } }] },
      ],
      course: { status: 'PUBLISHED' },
    },
    take: BATCH,
    include: { course: { select: { id: true, title: true } } },
  });
  if (enrollments.length === 0) return { sent: 0 };

  const students = await prisma.user.findMany({
    where: { id: { in: [...new Set(enrollments.map((e) => e.studentId))] }, isActive: true },
    select: { id: true, email: true, firstName: true },
  });
  const byId = new Map(students.map((s) => [s.id, s]));

  let sent = 0;
  for (const e of enrollments) {
    const u = byId.get(e.studentId);
    if (!u?.email) continue;
    const pct = Math.round(e.progress);
    await sendEmail({
      to: u.email,
      subject: `📚 ${u.firstName}, votre cours « ${e.course.title} » vous attend`,
      html: renderEmail({
        title: 'On continue ? 💪',
        greeting: `Bonjour ${u.firstName},`,
        body: pct > 0
          ? `Vous avez déjà accompli <b>${pct}%</b> du cours <b>« ${e.course.title} »</b> — il serait dommage de s'arrêter là ! Reprenez exactement là où vous en étiez : votre progression et vos notes sont sauvegardées.`
          : `Votre cours <b>« ${e.course.title} »</b> n'attend que vous. Quelques minutes par jour suffisent pour progresser — et le certificat est à la clé. 🎓`,
        ctaLabel: 'Reprendre mon cours',
        ctaUrl: `/online/course/${e.course.id}`,
        footer: 'Vous recevez ce rappel car votre cours est resté inactif. Reprenez-le pour ne plus recevoir de rappel.',
      }),
    });
    await prisma.enrollment.update({ where: { id: e.id }, data: { lastReminderAt: new Date() } });
    sent += 1;
  }
  console.log(`📧 reminders: ${sent} e-mail(s) « reprenez votre cours » envoyé(s)`);
  return { sent };
}

// Boot-time scheduler (called once from server.js).
export function startReminderJob() {
  const HALF_DAY = 12 * 60 * 60 * 1000;
  // First pass 2 min after boot (guarded by lastReminderAt, restarts are safe).
  setTimeout(() => sendCourseReminders().catch(() => {}), 2 * 60 * 1000);
  setInterval(() => sendCourseReminders().catch(() => {}), HALF_DAY);
  console.log('⏰ reminder job armed (12h interval)');
}
