import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { getSettings } from './lms-admin.service.js';
import { notifyUser } from '../../utils/notify.js';
import { validateCoupon, redeemCoupon } from './coupon.service.js';
import { sendEmail, renderEmail } from '../../utils/mailer.js';
import { cursusAccess } from '../cursus/cursus.access.js';
// Partage des revenus d'un cours payant : pourcentage enseignant réglable par le
// Super administrateur (25 % par défaut), le reste pour l'université.
import { getTeacherSharePercent } from '../finance/revenue-share.js';

async function makeReference() {
  // `reference` is globally unique, so count across all payments (not per
  // course) and add a short random suffix to be collision-proof under races.
  const count = await prisma.coursePayment.count();
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PAY-${year}-${String(count + 1).padStart(6, '0')}-${rand}`;
}


const INCLUDE = {
  course: { select: { id: true, title: true, price: true, thumbnail: true } },
  student: { select: { id: true, firstName: true, lastName: true, email: true } },
};

export async function createPayment({ studentId, courseId, method, senderNumber, transactionRef, amount, currency, remark, screenshotUrl, couponCode }) {
  const course = await prisma.onlineCourse.findUniqueOrThrow({
    where: { id: courseId },
    select: { id: true, price: true, courseKind: true, cursusLevel: true, mentionId: true, relatedCourseIds: true, cursusMonth: true },
  });
  // Un étudiant dans son propre cursus ne l'achète pas : l'écolage le débloque.
  const buyer = await prisma.user.findUnique({ where: { id: studentId }, select: { systemRole: true } });
  const cursus = await cursusAccess({ sub: studentId, role: buyer?.systemRole }, course);
  if (cursus.applies) {
    throw new HttpError(400, cursus.reason === 'not_student'
      ? "Le cursus universitaire est réservé aux étudiants de l'UR : déposez votre candidature pour y accéder."
      : cursus.reason === 'not_in_cursus'
        ? "Ce cours n'appartient pas à votre cursus."
        : "Ce cours fait partie de votre cursus universitaire : il est débloqué par l'écolage mensuel.");
  }

  // Block if already enrolled
  const existing = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
  });
  if (existing) throw new HttpError(409, 'Vous êtes déjà inscrit à ce cours');

  // Block if pending payment already exists
  const pending = await prisma.coursePayment.findFirst({
    where: { studentId, courseId, status: 'PENDING' },
  });
  if (pending) throw new HttpError(409, 'Un paiement est déjà en attente pour ce cours');

  // Apply a coupon if provided — the net amount is what the student pays.
  let netAmount = course.price ?? 0; // jamais le montant envoyé par le client
  let discountAmount = 0;
  let appliedCode = null;
  if (couponCode) {
    const v = await validateCoupon(studentId, couponCode, courseId);
    discountAmount = v.discountAmount;
    netAmount = v.finalPrice;
    appliedCode = v.code;
  }

  const reference = await makeReference();

  const payment = await prisma.coursePayment.create({
    data: {
      studentId, courseId, method, senderNumber, transactionRef,
      amount: netAmount,
      currency: currency ?? 'MGA',
      remark: remark ?? null,
      screenshotUrl: screenshotUrl ?? null,
      couponCode: appliedCode,
      discountAmount,
      reference,
      status: 'PENDING',
    },
    include: INCLUDE,
  });

  // Instant access: enroll the student immediately so they can start right
  // away. The payment still awaits admin validation; if it's later refused,
  // the enrollment is revoked in refusePayment(). A purchase is permanent, so
  // clear any subscription-only flag.
  await prisma.enrollment.upsert({
    where: { studentId_courseId: { studentId, courseId } },
    create: { studentId, courseId },
    update: { viaSubscription: false },
  });

  return payment;
}

export async function listPayments({ page = 1, limit = 20, status, courseId, q } = {}) {
  const where = {};
  if (status) where.status = status;
  if (courseId) where.courseId = courseId;
  if (q) {
    where.OR = [
      { reference: { contains: q } },
      { transactionRef: { contains: q } },
      { senderNumber: { contains: q } },
      { student: { email: { contains: q } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.coursePayment.findMany({
      where,
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.coursePayment.count({ where }),
  ]);

  return { items, total, page, limit };
}

export async function getPayment(id) {
  return prisma.coursePayment.findUniqueOrThrow({ where: { id }, include: INCLUDE });
}

export async function validatePayment(id, adminId) {
  const payment = await prisma.coursePayment.findUniqueOrThrow({ where: { id } });
  if (payment.status !== 'PENDING') throw new HttpError(400, 'Ce paiement n\'est pas en attente');
  const sharePercent = await getTeacherSharePercent();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.coursePayment.update({
      where: { id },
      data: { status: 'VALIDATED', validatedAt: new Date(), validatedBy: adminId },
      include: INCLUDE,
    });

    const exists = await tx.enrollment.findUnique({
      where: { studentId_courseId: { studentId: payment.studentId, courseId: payment.courseId } },
    });
    if (!exists) {
      await tx.enrollment.create({
        data: { studentId: payment.studentId, courseId: payment.courseId },
      });
    }

    // Part enseignant (pourcentage en vigueur) — reversée via la fiche de paie.
    if (updated.amount > 0) {
      const course = await tx.onlineCourse.findUnique({ where: { id: payment.courseId }, select: { teacherId: true } });
      const teacherShare = Math.round(updated.amount * (sharePercent / 100) * 100) / 100;
      await tx.teacherEarning.upsert({
        where: { paymentId: id },
        update: {},
        create: {
          teacherId: course.teacherId, courseId: payment.courseId, paymentId: id,
          grossAmount: updated.amount, teacherShare,
          universityShare: Math.round((updated.amount - teacherShare) * 100) / 100,
          currency: updated.currency,
        },
      });
    }

    // Record coupon usage now that the payment is confirmed.
    if (payment.couponCode) {
      await redeemCoupon(tx, payment.couponCode, payment.studentId, payment.courseId).catch(() => {});
    }

    notifyUser(payment.studentId, {
      type: 'PAYMENT',
      title: 'Paiement validé ✅',
      body: `Votre inscription au cours "${updated.course.title}" est confirmée. Bonne formation !`,
    }).catch(() => {});

    sendEmail({
      to: updated.student.email,
      subject: `✅ Inscription confirmée — ${updated.course.title}`,
      html: renderEmail({
        title: 'Votre inscription est confirmée !',
        greeting: `Bonjour ${updated.student.firstName},`,
        body: `Votre paiement de <b>${updated.amount.toLocaleString('fr-FR')} ${updated.currency}</b> (réf. ${updated.reference}) a été validé.<br/>Le cours <b>« ${updated.course.title} »</b> est désormais entièrement accessible : leçons, quiz, devoirs, sessions live et forum.`,
        ctaLabel: 'Commencer le cours',
        ctaUrl: `/online/course/${updated.course.id}`,
      }),
    }).catch(() => {});

    return updated;
  });
}

export async function refusePayment(id, adminId, reason) {
  const payment = await prisma.coursePayment.findUniqueOrThrow({ where: { id } });
  if (payment.status !== 'PENDING') throw new HttpError(400, 'Ce paiement n\'est pas en attente');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.coursePayment.update({
      where: { id },
      data: { status: 'REFUSED', refusedAt: new Date(), validatedBy: adminId, refusedReason: reason ?? null },
      include: INCLUDE,
    });
    // Revoke the optimistic access granted at submission time.
    await tx.enrollment.deleteMany({ where: { studentId: payment.studentId, courseId: payment.courseId } });
    notifyUser(payment.studentId, {
      type: 'PAYMENT',
      title: 'Paiement refusé',
      body: `Votre paiement pour « ${updated.course.title} » a été refusé.${reason ? ` Motif : ${reason}` : ''} L'accès au cours a été retiré.`,
    }).catch(() => {});
    return updated;
  });
}

// Achat d'un pack : tous les paiements du même pack (même étudiant, même
// référence de transaction) sont validés / refusés ensemble.
async function packSiblings(id) {
  const p = await prisma.coursePayment.findUniqueOrThrow({ where: { id } });
  if (!p.packId) return [p.id];
  const rows = await prisma.coursePayment.findMany({
    where: { packId: p.packId, studentId: p.studentId, transactionRef: p.transactionRef, status: 'PENDING' },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function validatePaymentGroup(id, adminId) {
  const ids = await packSiblings(id);
  let main = null;
  for (const pid of ids) {
    const r = await validatePayment(pid, adminId);
    if (pid === id) main = r;
  }
  return main ?? getPayment(id);
}

export async function refusePaymentGroup(id, adminId, reason) {
  const ids = await packSiblings(id);
  let main = null;
  for (const pid of ids) {
    const r = await refusePayment(pid, adminId, reason);
    if (pid === id) main = r;
  }
  return main ?? getPayment(id);
}

export async function myPayments(studentId) {
  return prisma.coursePayment.findMany({
    where: { studentId },
    include: { course: { select: { id: true, title: true, thumbnail: true, price: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

// ── Refunds (30-day guarantee) ──
const REFUND_WINDOW_DAYS = 30;

export async function requestRefund(studentId, paymentId, reason) {
  const p = await prisma.coursePayment.findUniqueOrThrow({ where: { id: paymentId } });
  if (p.studentId !== studentId) throw new HttpError(403, 'Action non autorisée');
  if (p.status !== 'VALIDATED') throw new HttpError(400, 'Seul un paiement validé peut être remboursé');
  const days = (Date.now() - new Date(p.validatedAt).getTime()) / 86_400_000;
  if (days > REFUND_WINDOW_DAYS) throw new HttpError(400, `La période de remboursement (${REFUND_WINDOW_DAYS} jours) est dépassée`);
  return prisma.coursePayment.update({
    where: { id: paymentId },
    data: { status: 'REFUND_REQUESTED', refundRequestedAt: new Date(), refundReason: reason ?? null },
    include: INCLUDE,
  });
}

export async function approveRefund(paymentId, adminId) {
  const p = await prisma.coursePayment.findUniqueOrThrow({ where: { id: paymentId } });
  if (p.status !== 'REFUND_REQUESTED') throw new HttpError(400, 'Aucune demande de remboursement en attente');
  return prisma.$transaction(async (tx) => {
    const updated = await tx.coursePayment.update({
      where: { id: paymentId },
      data: { status: 'REFUNDED', refundedAt: new Date(), refundedBy: adminId },
      include: INCLUDE,
    });
    // Revoke access.
    await tx.enrollment.deleteMany({ where: { studentId: p.studentId, courseId: p.courseId } });
    // La part enseignant pas encore versée est annulée.
    await tx.teacherEarning.updateMany({
      where: { paymentId, status: { in: ['PENDING', 'IN_PAYSLIP'] } },
      data: { status: 'CANCELLED' },
    });
    notifyUser(p.studentId, {
      type: 'PAYMENT',
      title: 'Remboursement approuvé 💸',
      body: `Votre remboursement pour « ${updated.course.title} » a été traité. L'accès au cours a été retiré.`,
    }).catch(() => {});
    return updated;
  });
}

export async function rejectRefund(paymentId, adminId, reason) {
  const p = await prisma.coursePayment.findUniqueOrThrow({ where: { id: paymentId } });
  if (p.status !== 'REFUND_REQUESTED') throw new HttpError(400, 'Aucune demande de remboursement en attente');
  const updated = await prisma.coursePayment.update({
    where: { id: paymentId },
    data: {
      status: 'VALIDATED',
      refundRequestedAt: null,
      remark: reason ? `Remboursement refusé : ${reason}` : p.remark,
    },
    include: INCLUDE,
  });
  notifyUser(p.studentId, {
    type: 'PAYMENT',
    title: 'Demande de remboursement refusée',
    body: reason ?? 'Votre demande de remboursement a été refusée.',
  }).catch(() => {});
  return updated;
}

export async function getMobileMoneySettings() {
  const s = await getSettings();
  return {
    mvola:       { numero: s.mvolaNumero ?? '',       nom: s.mvolaNom ?? '' },
    orangeMoney: { numero: s.orangeMoneyNumero ?? '', nom: s.orangeMoneyNom ?? '' },
    airtelMoney: { numero: s.airtelMoneyNumero ?? '', nom: s.airtelMoneyNom ?? '' },
  };
}

export async function paymentStats() {
  const [pending, validated, refused, refundRequested, refunded, totalAmount] = await Promise.all([
    prisma.coursePayment.count({ where: { status: 'PENDING' } }),
    prisma.coursePayment.count({ where: { status: 'VALIDATED' } }),
    prisma.coursePayment.count({ where: { status: 'REFUSED' } }),
    prisma.coursePayment.count({ where: { status: 'REFUND_REQUESTED' } }),
    prisma.coursePayment.count({ where: { status: 'REFUNDED' } }),
    prisma.coursePayment.aggregate({ where: { status: 'VALIDATED' }, _sum: { amount: true } }),
  ]);
  return { pending, validated, refused, refundRequested, refunded, totalValidated: totalAmount._sum.amount ?? 0 };
}
