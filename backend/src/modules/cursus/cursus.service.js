/**
 * cursus.service.js — cursus universitaire
 * Écolage mensuel · plan de cursus · syllabus · appel · suivi des séances ·
 * passage de niveau · espace parent · parts enseignants.
 */
import crypto from 'crypto';
import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { notifyUser, notifyUsers } from '../../utils/notify.js';
import { loadStaffContext } from '../../middlewares/rbac.js';
import {
  LEVELS, MONTHS, MAX_COURSES_PER_MONTH, MIN_COURSES_PER_MONTH, CURSUS_KINDS,
  semesterOfMonth, nextLevel, getStudentCursusProfile, cursusCoursesWhere, canPayMonth,
} from './cursus.access.js';

const round1 = (n) => Math.round(n * 10) / 10;
const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MOBILE_METHODS = ['MVOLA', 'ORANGE_MONEY', 'AIRTEL_MONEY'];
const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
const PERSON = { id: true, firstName: true, lastName: true, avatarUrl: true };

function slotHours(start, end) {
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  return Math.max(0, (h2 * 60 + m2 - (h1 * 60 + m1)) / 60);
}

// "YYYY-MM-DD" (jour local) → Date à minuit UTC, comme stocké en base.
function parseDay(str) {
  const s = str && /^\d{4}-\d{2}-\d{2}$/.test(str)
    ? str
    : new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return new Date(`${s}T00:00:00.000Z`);
}

// Mois du cursus en cours (1..8) d'après l'année universitaire courante.
async function currentCursusMonth() {
  const year = await prisma.academicYear.findFirst({ where: { isCurrent: true }, orderBy: { startDate: 'desc' } });
  if (!year) return null;
  const now = new Date();
  if (now > year.endDate || now < year.startDate) return null;
  const m = (now.getFullYear() - year.startDate.getFullYear()) * 12 + (now.getMonth() - year.startDate.getMonth()) + 1;
  return Math.min(8, Math.max(1, m));
}

function receiptNumber() {
  return `EC-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

async function usersWithPermission(code) {
  const rows = await prisma.userRole.findMany({
    where: { role: { rolePermissions: { some: { permission: { code } } } }, user: { isActive: true } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

// Mentions visibles par un membre du personnel (scope de ses rôles).
async function scopedMentionIds(req) {
  const staff = await loadStaffContext(req);
  return staff.isAdmin || staff.mentionIds.length === 0 ? null : staff.mentionIds;
}
async function assertMentionScope(req, mentionId) {
  const ids = await scopedMentionIds(req);
  if (ids && !ids.includes(mentionId)) throw new HttpError(403, 'Cette mention ne fait pas partie de votre périmètre');
}

// ─── Progression d'un cours : syllabus + volume horaire ───────────────────────
const COURSE_PROGRESS_INCLUDE = {
  teacher: { select: PERSON },
  syllabusItems: { orderBy: { order: 'asc' } },
  sessionLogs: { select: { hours: true, date: true } },
  curriculumEntry: { select: { id: true, plannedHours: true } },
  _count: { select: { enrollments: true } },
};

function courseProgress(course, curMonth) {
  const items = course.syllabusItems ?? [];
  const syllabusDone = items.filter((i) => i.isDone).length;
  const syllabusHours = items.reduce((s, i) => s + (i.plannedHours ?? 0), 0);
  const plannedHours = course.totalHours ?? course.curriculumEntry?.plannedHours ?? (syllabusHours || 0);
  const hoursDone = round1((course.sessionLogs ?? []).reduce((s, l) => s + l.hours, 0));
  const hoursRemaining = round1(Math.max(0, plannedHours - hoursDone));
  const syllabusPct = items.length ? Math.round((syllabusDone / items.length) * 100) : 0;

  let status = 'UPCOMING';
  if ((items.length > 0 && syllabusDone === items.length) || (plannedHours > 0 && hoursDone >= plannedHours)) {
    status = 'COMPLETED';
  } else if (hoursDone > 0 || syllabusDone > 0 || (curMonth && course.cursusMonth && course.cursusMonth <= curMonth)) {
    status = 'PRESENT';
  }
  return {
    plannedHours: round1(plannedHours), hoursDone, hoursRemaining,
    syllabusDone, syllabusTotal: items.length, syllabusPct, status,
  };
}

function courseSummary(course, curMonth) {
  return {
    id: course.id,
    title: course.title,
    thumbnail: course.thumbnail ?? null,
    status: course.status,
    courseKind: course.courseKind,
    cursusLevel: course.cursusLevel,
    cursusMonth: course.cursusMonth,
    mentionId: course.mentionId,
    teacher: course.teacher ?? null,
    enrollments: course._count?.enrollments ?? 0,
    syllabus: (course.syllabusItems ?? []).map((i) => ({
      id: i.id, title: i.title, description: i.description, plannedHours: i.plannedHours,
      order: i.order, isDone: i.isDone, doneAt: i.doneAt,
    })),
    progress: courseProgress(course, curMonth),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// ÉTUDIANT — vue d'ensemble du cursus et paiement de l'écolage
// ═════════════════════════════════════════════════════════════════════════════
async function buildStudentOverview(profile) {
  const { level, mentionId } = profile;
  const [setting, payments, courses] = await Promise.all([
    level && mentionId
      ? prisma.tuitionSetting.findUnique({ where: { mentionId_level: { mentionId, level } } })
      : null,
    level
      ? prisma.tuitionPayment.findMany({ where: { studentId: profile.id, level }, orderBy: { createdAt: 'desc' } })
      : [],
    level
      ? prisma.onlineCourse.findMany({
          where: cursusCoursesWhere(mentionId, level),
          include: COURSE_PROGRESS_INCLUDE,
          orderBy: [{ cursusMonth: 'asc' }, { title: 'asc' }],
        })
      : [],
  ]);
  const enrollments = courses.length
    ? await prisma.enrollment.findMany({
        where: { studentId: profile.userId, courseId: { in: courses.map((c) => c.id) } },
        select: { courseId: true, progress: true, completedAt: true },
      })
    : [];
  const enr = new Map(enrollments.map((e) => [e.courseId, e]));
  const curMonth = await currentCursusMonth();

  const months = [];
  for (const month of MONTHS) {
    const monthPayments = payments.filter((p) => p.month === month);
    const validated = monthPayments.find((p) => p.status === 'VALIDATED');
    const pending = monthPayments.find((p) => p.status === 'PENDING');
    const latest = validated ?? pending ?? monthPayments[0] ?? null;
    const monthCourses = courses.filter((c) => c.cursusMonth === month).map((c) => {
      const e = enr.get(c.id);
      return {
        ...courseSummary(c, curMonth),
        myProgress: e?.progress ?? 0,
        completed: Boolean(e?.completedAt),
        relatedCourseIds: c.relatedCourseIds,
      };
    });
    months.push({
      month,
      semester: semesterOfMonth(month),
      status: validated ? 'PAID' : pending ? 'PENDING' : latest?.status === 'REFUSED' ? 'REFUSED' : 'UNPAID',
      payment: latest,
      courses: monthCourses,
      completed: monthCourses.every((c) => c.completed),
    });
  }

  // Règle de déblocage : mois N payable si N-1 payé ET terminé à 100 %.
  for (const m of months) {
    const prev = months[m.month - 2];
    if (m.status === 'PAID' || m.status === 'PENDING') { m.canPay = false; m.lockReason = null; continue; }
    if (!level) { m.canPay = false; m.lockReason = "Aucun niveau n'est associé à votre dossier."; continue; }
    if (!prev) { m.canPay = true; m.lockReason = null; continue; }
    if (prev.status !== 'PAID') { m.canPay = false; m.lockReason = `Payez d'abord le mois ${prev.month}.`; continue; }
    if (!prev.completed) { m.canPay = false; m.lockReason = `Terminez à 100 % les cours du mois ${prev.month}.`; continue; }
    m.canPay = true; m.lockReason = null;
  }

  const paidCount = months.filter((m) => m.status === 'PAID').length;
  const completedCount = months.filter((m) => m.status === 'PAID' && m.completed).length;
  return {
    student: {
      id: profile.id, userId: profile.userId, matricule: profile.matricule,
      level, mention: profile.mention, promotion: profile.promotion,
    },
    monthlyAmount: setting?.monthlyAmount ?? null,
    currency: setting?.currency ?? 'MGA',
    currentMonth: curMonth,
    months,
    paidCount,
    completedCount,
    nextPayableMonth: months.find((m) => m.canPay)?.month ?? null,
    eligibleForPassage: paidCount === MONTHS.length && completedCount === MONTHS.length,
  };
}

async function requireStudentProfile(userId) {
  const profile = await getStudentCursusProfile(userId);
  if (!profile) throw new HttpError(403, 'Profil étudiant requis');
  return profile;
}

async function profileByStudentId(studentId) {
  const sp = await prisma.studentProfile.findUnique({ where: { id: studentId }, select: { userId: true } });
  if (!sp) throw new HttpError(404, 'Étudiant introuvable');
  return getStudentCursusProfile(sp.userId);
}

export async function myCursus(user) {
  return buildStudentOverview(await requireStudentProfile(user.sub));
}

export async function declareTuition(user, body) {
  const profile = await requireStudentProfile(user.sub);
  const month = Number(body.month);
  const check = await canPayMonth(profile, month);
  if (!check.ok) throw new HttpError(400, check.reason);
  if (!MOBILE_METHODS.includes(body.method)) throw new HttpError(400, 'Moyen de paiement invalide');
  if (!body.senderNumber?.trim() || !body.transactionRef?.trim()) {
    throw new HttpError(400, 'Numéro expéditeur et référence de transaction requis');
  }
  const pending = await prisma.tuitionPayment.findFirst({
    where: { studentId: profile.id, level: profile.level, month, status: 'PENDING' },
  });
  if (pending) throw new HttpError(409, 'Un paiement est déjà en attente de validation pour ce mois');

  const setting = await prisma.tuitionSetting.findUnique({
    where: { mentionId_level: { mentionId: profile.mentionId, level: profile.level } },
  });
  if (!setting) throw new HttpError(400, "Le montant de l'écolage n'est pas encore configuré pour votre niveau. Contactez la comptabilité.");

  const payment = await prisma.tuitionPayment.create({
    data: {
      studentId: profile.id, mentionId: profile.mentionId, level: profile.level, month,
      amount: setting.monthlyAmount, currency: setting.currency, method: body.method, source: 'STUDENT',
      senderNumber: body.senderNumber.trim(), transactionRef: body.transactionRef.trim(),
      screenshotUrl: body.screenshotUrl ?? null, note: body.note ?? null, recordedById: user.sub,
    },
  });
  notifyUsers(await usersWithPermission('MANAGE_TUITION'), {
    type: 'PAYMENT',
    title: 'Écolage à valider',
    body: `${profile.matricule} — mois ${month} (${profile.level}) : ${setting.monthlyAmount.toLocaleString('fr-FR')} ${setting.currency}`,
    link: '/classroom/ecolage',
  }).catch(() => {});
  return payment;
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPTABILITÉ — validation de l'écolage, guichet, tarifs, parts enseignants
// ═════════════════════════════════════════════════════════════════════════════
const TUITION_INCLUDE = {
  student: {
    select: {
      id: true, matricule: true,
      user: { select: { firstName: true, lastName: true, email: true } },
      promotion: { select: { name: true, level: true } },
      mention: { select: { name: true } },
    },
  },
};

export async function listTuition({ status, q, month, level, mentionId, page = 1, limit = 30 }) {
  page = Math.max(1, Number(page) || 1);
  limit = Math.min(100, Math.max(1, Number(limit) || 30));
  const where = {
    ...(status && { status }),
    ...(month && { month: Number(month) }),
    ...(level && { level }),
    ...(mentionId && { mentionId }),
    ...(q && {
      student: {
        OR: [
          { matricule: { contains: q, mode: 'insensitive' } },
          { user: { firstName: { contains: q, mode: 'insensitive' } } },
          { user: { lastName: { contains: q, mode: 'insensitive' } } },
        ],
      },
    }),
  };
  const [items, total] = await Promise.all([
    prisma.tuitionPayment.findMany({
      where, include: TUITION_INCLUDE, orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit, take: limit,
    }),
    prisma.tuitionPayment.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function tuitionStats() {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [pending, validatedMonth, validatedAll, refused] = await Promise.all([
    prisma.tuitionPayment.count({ where: { status: 'PENDING' } }),
    prisma.tuitionPayment.aggregate({ where: { status: 'VALIDATED', validatedAt: { gte: startOfMonth } }, _sum: { amount: true }, _count: true }),
    prisma.tuitionPayment.aggregate({ where: { status: 'VALIDATED' }, _sum: { amount: true }, _count: true }),
    prisma.tuitionPayment.count({ where: { status: 'REFUSED' } }),
  ]);
  return {
    pending,
    refused,
    monthAmount: validatedMonth._sum.amount ?? 0,
    monthCount: validatedMonth._count,
    totalAmount: validatedAll._sum.amount ?? 0,
    totalCount: validatedAll._count,
  };
}

async function notifyMonthUnlocked(payment) {
  const sp = await prisma.studentProfile.findUnique({
    where: { id: payment.studentId },
    select: { userId: true, parentLinks: { select: { parent: { select: { userId: true } } } } },
  });
  if (!sp) return;
  await notifyUser(sp.userId, {
    type: 'PAYMENT',
    title: `Mois ${payment.month} débloqué ✅`,
    body: `Votre écolage du mois ${payment.month} est validé (reçu ${payment.receiptNumber}). Les cours du mois sont accessibles.`,
    link: '/classroom/cursus',
  });
  const parents = sp.parentLinks.map((l) => l.parent.userId);
  if (parents.length) {
    await notifyUsers(parents, {
      type: 'PAYMENT',
      title: `Écolage du mois ${payment.month} validé`,
      body: `Reçu ${payment.receiptNumber} — ${payment.amount.toLocaleString('fr-FR')} ${payment.currency}.`,
      link: '/classroom/parent',
    });
  }
}

export async function validateTuition(staffUserId, id) {
  const p = await prisma.tuitionPayment.findUnique({ where: { id } });
  if (!p) throw new HttpError(404, 'Paiement introuvable');
  if (p.status !== 'PENDING') throw new HttpError(400, "Ce paiement n'est pas en attente");
  const already = await prisma.tuitionPayment.findFirst({
    where: { studentId: p.studentId, level: p.level, month: p.month, status: 'VALIDATED' },
  });
  if (already) throw new HttpError(409, 'Ce mois est déjà payé pour cet étudiant');
  const updated = await prisma.tuitionPayment.update({
    where: { id },
    data: { status: 'VALIDATED', validatedById: staffUserId, validatedAt: new Date(), receiptNumber: receiptNumber() },
    include: TUITION_INCLUDE,
  });
  notifyMonthUnlocked(updated).catch(() => {});
  return updated;
}

export async function refuseTuition(staffUserId, id, reason) {
  const p = await prisma.tuitionPayment.findUnique({ where: { id }, include: { student: { select: { userId: true } } } });
  if (!p) throw new HttpError(404, 'Paiement introuvable');
  if (p.status !== 'PENDING') throw new HttpError(400, "Ce paiement n'est pas en attente");
  const updated = await prisma.tuitionPayment.update({
    where: { id },
    data: { status: 'REFUSED', validatedById: staffUserId, validatedAt: new Date(), refusedReason: reason ?? null },
    include: TUITION_INCLUDE,
  });
  notifyUser(p.student.userId, {
    type: 'PAYMENT',
    title: `Paiement du mois ${p.month} refusé`,
    body: reason ? `Motif : ${reason}` : 'Vérifiez la référence de transaction et soumettez à nouveau.',
    link: '/classroom/cursus',
  }).catch(() => {});
  return updated;
}

// Paiement encaissé au guichet : directement validé, avec reçu.
export async function recordCashTuition(staffUserId, { studentId, month, amount, note }) {
  const profile = await profileByStudentId(studentId);
  month = Number(month);
  const check = await canPayMonth(profile, month);
  if (!check.ok) throw new HttpError(400, check.reason);
  const pending = await prisma.tuitionPayment.findFirst({
    where: { studentId: profile.id, level: profile.level, month, status: 'PENDING' },
  });
  if (pending) throw new HttpError(409, 'Un paiement Mobile Money est en attente pour ce mois : validez-le plutôt.');
  const setting = profile.mentionId
    ? await prisma.tuitionSetting.findUnique({ where: { mentionId_level: { mentionId: profile.mentionId, level: profile.level } } })
    : null;
  const value = Number(amount) || setting?.monthlyAmount;
  if (!value) throw new HttpError(400, "Montant requis (aucun tarif d'écolage configuré pour ce niveau)");

  const payment = await prisma.tuitionPayment.create({
    data: {
      studentId: profile.id, mentionId: profile.mentionId, level: profile.level, month,
      amount: value, currency: setting?.currency ?? 'MGA', method: 'CASH', source: 'CASHIER',
      note: note ?? null, recordedById: staffUserId,
      status: 'VALIDATED', validatedById: staffUserId, validatedAt: new Date(), receiptNumber: receiptNumber(),
    },
    include: TUITION_INCLUDE,
  });
  notifyMonthUnlocked(payment).catch(() => {});
  return payment;
}

// Recherche d'étudiants pour le guichet, avec le prochain mois payable.
export async function searchStudentsForTuition(q) {
  const students = await prisma.studentProfile.findMany({
    where: {
      status: 'ACTIVE',
      ...(q && {
        OR: [
          { matricule: { contains: q, mode: 'insensitive' } },
          { user: { firstName: { contains: q, mode: 'insensitive' } } },
          { user: { lastName: { contains: q, mode: 'insensitive' } } },
        ],
      }),
    },
    select: { userId: true },
    take: 10,
  });
  const out = [];
  for (const s of students) {
    const profile = await getStudentCursusProfile(s.userId);
    const user = await prisma.user.findUnique({ where: { id: s.userId }, select: { firstName: true, lastName: true } });
    const ov = await buildStudentOverview(profile);
    out.push({
      id: profile.id, matricule: profile.matricule, ...user,
      level: profile.level, mention: profile.mention, promotion: profile.promotion,
      monthlyAmount: ov.monthlyAmount, nextPayableMonth: ov.nextPayableMonth,
      months: ov.months.map((m) => ({ month: m.month, status: m.status, canPay: m.canPay, lockReason: m.lockReason })),
    });
  }
  return out;
}

export async function tuitionSettings() {
  const [settings, mentions, promotions] = await Promise.all([
    prisma.tuitionSetting.findMany({ include: { mention: { select: { id: true, name: true } } } }),
    prisma.mention.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } }),
    prisma.promotion.findMany({ select: { mentionId: true, level: true } }),
  ]);
  const levelsByMention = {};
  for (const p of promotions) (levelsByMention[p.mentionId] ??= new Set()).add(p.level);
  return {
    settings,
    mentions: mentions.map((m) => ({
      ...m,
      levels: LEVELS.filter((l) => levelsByMention[m.id]?.has(l)),
    })),
    levels: LEVELS,
  };
}

export async function upsertTuitionSetting({ mentionId, level, monthlyAmount, currency }) {
  if (!mentionId || !LEVELS.includes(level)) throw new HttpError(400, 'Mention et niveau requis');
  const amount = Number(monthlyAmount);
  if (!(amount > 0)) throw new HttpError(400, 'Montant mensuel invalide');
  return prisma.tuitionSetting.upsert({
    where: { mentionId_level: { mentionId, level } },
    update: { monthlyAmount: amount, ...(currency && { currency }) },
    create: { mentionId, level, monthlyAmount: amount, currency: currency ?? 'MGA' },
  });
}

// Parts enseignants (50 %) — vue comptabilité.
export async function earningsOverview() {
  const rows = await prisma.teacherEarning.findMany({
    include: {
      teacher: { select: PERSON },
      course: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const byTeacher = new Map();
  for (const e of rows) {
    const t = byTeacher.get(e.teacherId) ?? {
      teacher: e.teacher, pending: 0, inPayslip: 0, paid: 0, gross: 0, universityShare: 0, sales: 0,
    };
    if (e.status !== 'CANCELLED') {
      t.gross += e.grossAmount;
      t.universityShare += e.universityShare;
      t.sales += 1;
      if (e.status === 'PENDING') t.pending += e.teacherShare;
      if (e.status === 'IN_PAYSLIP') t.inPayslip += e.teacherShare;
      if (e.status === 'PAID') t.paid += e.teacherShare;
    }
    byTeacher.set(e.teacherId, t);
  }
  return { teachers: [...byTeacher.values()], recent: rows.slice(0, 50) };
}

export async function myEarnings(user) {
  const rows = await prisma.teacherEarning.findMany({
    where: { teacherId: user.sub },
    include: { course: { select: { id: true, title: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const sum = (st) => rows.filter((r) => st.includes(r.status)).reduce((s, r) => s + r.teacherShare, 0);
  return {
    pending: sum(['PENDING', 'IN_PAYSLIP']),
    paid: sum(['PAID']),
    total: sum(['PENDING', 'IN_PAYSLIP', 'PAID']),
    items: rows,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// RESPONSABLE DE MENTION — plan du cursus et attribution des cours
// ═════════════════════════════════════════════════════════════════════════════
export async function curriculumOptions(req, mentionId) {
  const scope = await scopedMentionIds(req);
  const mentions = await prisma.mention.findMany({
    where: { isActive: true, ...(scope && { id: { in: scope } }) },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });
  const mid = mentionId ?? mentions[0]?.id;
  const [teachers, subjects, courses] = await Promise.all([
    prisma.user.findMany({
      where: { systemRole: { in: ['TEACHER', 'TEACHER_ONLINE'] }, isActive: true },
      select: { ...PERSON, email: true, systemRole: true },
      orderBy: { lastName: 'asc' },
    }),
    mid ? prisma.subject.findMany({ where: { mentionId: mid, isActive: true }, select: { id: true, name: true, code: true, credits: true }, orderBy: { name: 'asc' } }) : [],
    mid ? prisma.onlineCourse.findMany({
      where: { courseKind: { in: CURSUS_KINDS }, OR: [{ mentionId: mid }, { mentionId: null }] },
      select: { id: true, title: true, cursusLevel: true, cursusMonth: true },
      orderBy: { title: 'asc' },
    }) : [],
  ]);
  return { mentions, teachers, subjects, courses, levels: LEVELS, months: MONTHS };
}

export async function listCurriculum(req, { mentionId, level }) {
  if (!mentionId || !level) throw new HttpError(400, 'mentionId et level requis');
  await assertMentionScope(req, mentionId);
  const curMonth = await currentCursusMonth();
  const entries = await prisma.curriculumEntry.findMany({
    where: { mentionId, level },
    include: {
      teacher: { select: PERSON },
      subject: { select: { id: true, name: true, code: true } },
      course: { include: COURSE_PROGRESS_INCLUDE },
    },
    orderBy: [{ month: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
  });
  const months = MONTHS.map((month) => {
    const list = entries.filter((e) => e.month === month).map((e) => ({
      id: e.id, title: e.title, description: e.description, month: e.month, level: e.level,
      plannedHours: e.plannedHours, order: e.order,
      teacher: e.teacher, subject: e.subject,
      course: e.course ? courseSummary(e.course, curMonth) : null,
    }));
    return {
      month,
      semester: semesterOfMonth(month),
      entries: list,
      warning: list.length < MIN_COURSES_PER_MONTH
        ? `Moins de ${MIN_COURSES_PER_MONTH} cours ce mois-ci`
        : null,
    };
  });
  return { mentionId, level, currentMonth: curMonth, months, total: entries.length };
}

async function assertMonthCapacity(mentionId, level, month, excludeId) {
  const n = await prisma.curriculumEntry.count({
    where: { mentionId, level, month, ...(excludeId && { id: { not: excludeId } }) },
  });
  if (n >= MAX_COURSES_PER_MONTH) {
    throw new HttpError(400, `Le mois ${month} a déjà ${MAX_COURSES_PER_MONTH} cours (maximum).`);
  }
}

async function assertTeacher(teacherId) {
  if (!teacherId) return;
  const t = await prisma.user.findUnique({ where: { id: teacherId }, select: { systemRole: true } });
  if (!t || !['TEACHER', 'TEACHER_ONLINE'].includes(t.systemRole)) throw new HttpError(400, 'Enseignant invalide');
}

function notifyAssignment(teacherId, entry) {
  return notifyUser(teacherId, {
    type: 'INFO',
    title: 'Nouveau cours attribué',
    body: `« ${entry.title} » — ${entry.level}, mois ${entry.month}. Créez son contenu et son syllabus.`,
    link: '/classroom/mes-cours',
  }).catch(() => {});
}

export async function createCurriculumEntry(req, body) {
  const { mentionId, level, title } = body;
  const month = Number(body.month);
  if (!mentionId || !LEVELS.includes(level) || !MONTHS.includes(month) || !title?.trim()) {
    throw new HttpError(400, 'Mention, niveau, mois (1 à 8) et intitulé requis');
  }
  await assertMentionScope(req, mentionId);
  await assertMonthCapacity(mentionId, level, month);
  await assertTeacher(body.teacherId);
  const entry = await prisma.curriculumEntry.create({
    data: {
      mentionId, level, month, title: title.trim(),
      description: body.description ?? null,
      subjectId: body.subjectId || null,
      teacherId: body.teacherId || null,
      plannedHours: Number(body.plannedHours) > 0 ? Number(body.plannedHours) : 30,
      order: Number(body.order) || 0,
      createdById: req.user.sub,
    },
  });
  if (entry.teacherId) notifyAssignment(entry.teacherId, entry);
  return entry;
}

export async function updateCurriculumEntry(req, id, body) {
  const entry = await prisma.curriculumEntry.findUnique({ where: { id } });
  if (!entry) throw new HttpError(404, 'Élément du cursus introuvable');
  await assertMentionScope(req, entry.mentionId);
  const month = body.month !== undefined ? Number(body.month) : entry.month;
  const level = body.level ?? entry.level;
  if (!MONTHS.includes(month) || !LEVELS.includes(level)) throw new HttpError(400, 'Mois ou niveau invalide');
  if (month !== entry.month || level !== entry.level) await assertMonthCapacity(entry.mentionId, level, month, id);
  if (body.teacherId !== undefined) await assertTeacher(body.teacherId);

  const updated = await prisma.curriculumEntry.update({
    where: { id },
    data: {
      month, level,
      ...(body.title !== undefined && { title: body.title.trim() }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.subjectId !== undefined && { subjectId: body.subjectId || null }),
      ...(body.teacherId !== undefined && { teacherId: body.teacherId || null }),
      ...(body.plannedHours !== undefined && { plannedHours: Number(body.plannedHours) || entry.plannedHours }),
      ...(body.order !== undefined && { order: Number(body.order) || 0 }),
    },
  });
  // Le cours déjà construit suit l'attribution (nouveau prof, nouveau mois).
  if (entry.courseId) {
    await prisma.onlineCourse.update({
      where: { id: entry.courseId },
      data: {
        cursusMonth: month, cursusLevel: level,
        ...(updated.teacherId && updated.teacherId !== entry.teacherId && { teacherId: updated.teacherId }),
        ...(body.plannedHours !== undefined && { totalHours: updated.plannedHours }),
      },
    });
  }
  if (updated.teacherId && updated.teacherId !== entry.teacherId) notifyAssignment(updated.teacherId, updated);
  return updated;
}

export async function deleteCurriculumEntry(req, id) {
  const entry = await prisma.curriculumEntry.findUnique({ where: { id } });
  if (!entry) throw new HttpError(404, 'Élément du cursus introuvable');
  await assertMentionScope(req, entry.mentionId);
  // Le cours en ligne éventuel est conservé (simplement détaché du plan).
  await prisma.curriculumEntry.delete({ where: { id } });
  return { ok: true };
}

// Supervision : liste des cours du cursus et leur progression.
export async function supervision(req, { mentionId, level }) {
  const scope = await scopedMentionIds(req);
  if (mentionId && scope && !scope.includes(mentionId)) throw new HttpError(403, 'Hors de votre périmètre');
  const curMonth = await currentCursusMonth();
  const courses = await prisma.onlineCourse.findMany({
    where: {
      courseKind: { in: CURSUS_KINDS },
      ...(level && { cursusLevel: level }),
      ...(mentionId ? { mentionId } : scope ? { mentionId: { in: scope } } : {}),
    },
    include: COURSE_PROGRESS_INCLUDE,
    orderBy: [{ cursusLevel: 'asc' }, { cursusMonth: 'asc' }, { title: 'asc' }],
  });
  const stats = courses.length
    ? await prisma.enrollment.groupBy({
        by: ['courseId'],
        where: { courseId: { in: courses.map((c) => c.id) } },
        _avg: { progress: true },
        _count: { _all: true },
      })
    : [];
  const completed = courses.length
    ? await prisma.enrollment.groupBy({
        by: ['courseId'],
        where: { courseId: { in: courses.map((c) => c.id) }, completedAt: { not: null } },
        _count: { _all: true },
      })
    : [];
  const statMap = new Map(stats.map((s) => [s.courseId, s]));
  const doneMap = new Map(completed.map((s) => [s.courseId, s._count._all]));
  const mentions = await prisma.mention.findMany({
    where: { ...(scope && { id: { in: scope } }) }, select: { id: true, name: true },
  });
  return {
    currentMonth: curMonth,
    mentions,
    courses: courses.map((c) => ({
      ...courseSummary(c, curMonth),
      students: statMap.get(c.id)?._count._all ?? 0,
      avgStudentProgress: Math.round(statMap.get(c.id)?._avg.progress ?? 0),
      studentsCompleted: doneMap.get(c.id) ?? 0,
    })),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// ENSEIGNANT — déroulement de mes cours, syllabus
// ═════════════════════════════════════════════════════════════════════════════
export async function teacherCourses(user) {
  const curMonth = await currentCursusMonth();
  const [courses, assignments] = await Promise.all([
    prisma.onlineCourse.findMany({
      where: { teacherId: user.sub, courseKind: { in: CURSUS_KINDS } },
      include: COURSE_PROGRESS_INCLUDE,
      orderBy: [{ cursusLevel: 'asc' }, { cursusMonth: 'asc' }],
    }),
    prisma.curriculumEntry.findMany({
      where: { teacherId: user.sub, courseId: null },
      include: { mention: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } } },
      orderBy: [{ level: 'asc' }, { month: 'asc' }],
    }),
  ]);
  const list = courses.map((c) => courseSummary(c, curMonth));
  return {
    currentMonth: curMonth,
    present: list.filter((c) => c.progress.status === 'PRESENT'),
    upcoming: list.filter((c) => c.progress.status === 'UPCOMING'),
    completed: list.filter((c) => c.progress.status === 'COMPLETED'),
    assignments,
  };
}

async function getOwnedCourse(user, courseId) {
  const course = await prisma.onlineCourse.findUnique({ where: { id: courseId }, select: { id: true, teacherId: true } });
  if (!course) throw new HttpError(404, 'Cours introuvable');
  if (course.teacherId !== user.sub && user.systemRole !== 'SUPER_ADMIN') throw new HttpError(403, "Ce cours ne vous appartient pas");
  return course;
}

export async function listSyllabus(courseId) {
  return prisma.syllabusItem.findMany({ where: { courseId }, orderBy: { order: 'asc' } });
}

export async function addSyllabusItem(user, courseId, { title, description, plannedHours }) {
  await getOwnedCourse(user, courseId);
  if (!title?.trim()) throw new HttpError(400, 'Intitulé requis');
  const last = await prisma.syllabusItem.findFirst({ where: { courseId }, orderBy: { order: 'desc' } });
  return prisma.syllabusItem.create({
    data: {
      courseId, title: title.trim(), description: description ?? null,
      plannedHours: Number(plannedHours) > 0 ? Number(plannedHours) : 2,
      order: (last?.order ?? -1) + 1,
    },
  });
}

export async function updateSyllabusItem(user, id, body) {
  const item = await prisma.syllabusItem.findUnique({ where: { id } });
  if (!item) throw new HttpError(404, 'Élément du syllabus introuvable');
  await getOwnedCourse(user, item.courseId);
  return prisma.syllabusItem.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title.trim() }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.plannedHours !== undefined && { plannedHours: Number(body.plannedHours) || item.plannedHours }),
    },
  });
}

export async function deleteSyllabusItem(user, id) {
  const item = await prisma.syllabusItem.findUnique({ where: { id } });
  if (!item) throw new HttpError(404, 'Élément du syllabus introuvable');
  await getOwnedCourse(user, item.courseId);
  await prisma.syllabusItem.delete({ where: { id } });
  return { ok: true };
}

export async function reorderSyllabus(user, courseId, ids) {
  await getOwnedCourse(user, courseId);
  if (!Array.isArray(ids)) throw new HttpError(400, 'ids requis');
  await prisma.$transaction(ids.map((id, order) => prisma.syllabusItem.updateMany({ where: { id, courseId }, data: { order } })));
  return listSyllabus(courseId);
}

// Secrétaire : coche / décoche un point du syllabus à la fin du cours.
export async function toggleSyllabusItem(user, id, done) {
  const item = await prisma.syllabusItem.findUnique({ where: { id } });
  if (!item) throw new HttpError(404, 'Élément du syllabus introuvable');
  return prisma.syllabusItem.update({
    where: { id },
    data: done
      ? { isDone: true, doneAt: new Date(), doneById: user.sub }
      : { isDone: false, doneAt: null, doneById: null },
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// SECRÉTARIAT — emploi du temps du jour, appel, suivi des séances
// ═════════════════════════════════════════════════════════════════════════════
const SLOT_INCLUDE = {
  teacher: { select: PERSON },
  room: { select: { id: true, name: true, code: true } },
  group: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true, code: true } },
  promotion: { select: { id: true, name: true, level: true, mentionId: true } },
};

// Créneaux d'un jour : emplois du temps publiés/validés, sinon tous.
async function slotsForDay(where) {
  const published = await prisma.scheduleSlot.findMany({
    where: { ...where, schedulePeriod: { status: { in: ['PUBLISHED', 'VALIDATED'] } } },
    include: SLOT_INCLUDE,
    orderBy: { startTime: 'asc' },
  });
  if (published.length) return published;
  return prisma.scheduleSlot.findMany({ where, include: SLOT_INCLUDE, orderBy: { startTime: 'asc' } });
}

export async function attendancePromotions(req) {
  const scope = await scopedMentionIds(req);
  return prisma.promotion.findMany({
    where: { ...(scope && { mentionId: { in: scope } }) },
    select: {
      id: true, name: true, level: true,
      mention: { select: { id: true, name: true } },
      groups: { select: { id: true, name: true } },
      _count: { select: { students: true } },
    },
    orderBy: [{ name: 'asc' }],
  });
}

export async function attendanceDay({ promotionId, groupId, date }) {
  if (!promotionId) throw new HttpError(400, 'promotionId requis');
  const day = parseDay(date);
  const dow = DAYS[day.getUTCDay()];
  const promotion = await prisma.promotion.findUnique({
    where: { id: promotionId },
    select: { id: true, name: true, level: true, mention: { select: { id: true, name: true } } },
  });
  if (!promotion) throw new HttpError(404, 'Promotion introuvable');

  const slots = await slotsForDay({
    promotionId, day: dow,
    ...(groupId && { OR: [{ groupId }, { groupId: null }] }),
  });
  const students = await prisma.studentProfile.findMany({
    where: { promotionId, status: 'ACTIVE', ...(groupId && { groupId }) },
    select: { id: true, matricule: true, user: { select: PERSON }, group: { select: { name: true } } },
    orderBy: { user: { lastName: 'asc' } },
  });
  const records = slots.length && students.length
    ? await prisma.attendance.findMany({
        where: { date: day, scheduleSlotId: { in: slots.map((s) => s.id) }, studentId: { in: students.map((s) => s.id) } },
        select: { id: true, studentId: true, scheduleSlotId: true, status: true, comment: true },
      })
    : [];
  return {
    date: day.toISOString().slice(0, 10),
    dayOfWeek: dow,
    promotion,
    slots: slots.map((s) => ({ ...s, hours: slotHours(s.startTime, s.endTime) })),
    students,
    records,
  };
}

export async function saveAttendance(user, { date, slotId, records }) {
  if (!slotId || !Array.isArray(records)) throw new HttpError(400, 'slotId et records requis');
  const day = parseDay(date);
  const slot = await prisma.scheduleSlot.findUnique({
    where: { id: slotId }, select: { id: true, subjectId: true, promotionId: true },
  });
  if (!slot) throw new HttpError(404, 'Créneau introuvable');
  const teacherProfile = await prisma.scheduleSlot.findUnique({
    where: { id: slotId }, select: { teacher: { select: { teacherProfile: { select: { id: true } } } } },
  });
  const teacherId = teacherProfile?.teacher?.teacherProfile?.id ?? null;

  let saved = 0;
  for (const r of records) {
    if (!ATTENDANCE_STATUSES.includes(r.status)) continue;
    const existing = await prisma.attendance.findFirst({
      where: { studentId: r.studentId, date: day, scheduleSlotId: slotId },
      select: { id: true },
    });
    if (existing) {
      await prisma.attendance.update({
        where: { id: existing.id },
        data: { status: r.status, comment: r.comment ?? null, recordedById: user.sub },
      });
    } else {
      await prisma.attendance.create({
        data: {
          studentId: r.studentId, date: day, status: r.status, comment: r.comment ?? null,
          scheduleSlotId: slotId, subjectId: slot.subjectId, teacherId, recordedById: user.sub,
        },
      });
    }
    saved += 1;
  }
  notifyAbsences(day, slotId, records).catch(() => {});
  return { saved };
}

// Notification individuelle à l'étudiant absent / en retard et à ses parents
async function notifyAbsences(day, slotId, records) {
  const flagged = records.filter((r) => r.status === 'ABSENT' || r.status === 'LATE');
  if (!flagged.length) return;
  const slot = await prisma.scheduleSlot.findUnique({ where: { id: slotId }, select: { subjectName: true, startTime: true } });
  const dateLabel = day.toLocaleDateString('fr-FR');
  for (const r of flagged) {
    const sp = await prisma.studentProfile.findUnique({
      where: { id: r.studentId },
      select: { userId: true, user: { select: { firstName: true } }, parentLinks: { select: { parent: { select: { userId: true } } } } },
    });
    if (!sp) continue;
    const what = r.status === 'ABSENT' ? 'Absence' : 'Retard';
    const course = `${slot?.subjectName ?? 'cours'} du ${dateLabel}${slot?.startTime ? ` (${slot.startTime})` : ''}`;
    await notifyUser(sp.userId, { type: 'WARNING', title: `${what} enregistré(e)`, body: `${what} au ${course}.`, link: '/classroom/presences' });
    const parents = sp.parentLinks.map((l) => l.parent.userId);
    if (parents.length) {
      await notifyUsers(parents, { type: 'WARNING', title: `${what} de ${sp.user.firstName}`, body: `${what} au ${course}.`, link: '/classroom/parent' });
    }
  }
}

// Cours du cursus correspondant à un créneau (même mention/niveau ; matière ou prof).
function resolveSlotCourse(slot, courses, curMonth) {
  const candidates = courses.filter((c) =>
    c.cursusLevel === slot.promotion.level
    && (!c.mentionId || c.mentionId === slot.promotion.mentionId)
    && ((slot.subjectId && c.subjectId === slot.subjectId) || c.teacherId === slot.teacherUserId));
  if (!candidates.length) return null;
  const bySubject = candidates.filter((c) => slot.subjectId && c.subjectId === slot.subjectId);
  // Par défaut, le cours le plus ancien du cursus encore inachevé.
  const pool = (bySubject.length ? bySubject : candidates).sort((a, b) => (a.cursusMonth ?? 0) - (b.cursusMonth ?? 0));
  return pool.find((c) => c.cursusMonth === curMonth)
    ?? pool.find((c) => c.syllabusItems.some((i) => !i.isDone))
    ?? pool[0];
}

export async function sessionsDay(req, { date, mentionId }) {
  const scope = await scopedMentionIds(req);
  const day = parseDay(date);
  const dow = DAYS[day.getUTCDay()];
  const mentionFilter = mentionId ? [mentionId] : scope;
  const slots = await slotsForDay({
    day: dow,
    ...(mentionFilter && { promotion: { mentionId: { in: mentionFilter } } }),
  });
  const curMonth = await currentCursusMonth();
  const [logs, courses] = await Promise.all([
    slots.length ? prisma.courseSessionLog.findMany({ where: { date: day, slotId: { in: slots.map((s) => s.id) } } }) : [],
    prisma.onlineCourse.findMany({
      where: { courseKind: { in: CURSUS_KINDS } },
      include: COURSE_PROGRESS_INCLUDE,
    }),
  ]);
  const logBySlot = new Map(logs.map((l) => [l.slotId, l]));
  return {
    date: day.toISOString().slice(0, 10),
    dayOfWeek: dow,
    currentMonth: curMonth,
    sessions: slots.map((s) => {
      const course = resolveSlotCourse(s, courses, curMonth);
      return {
        slot: { ...s, hours: slotHours(s.startTime, s.endTime) },
        log: logBySlot.get(s.id) ?? null,
        course: course ? courseSummary(course, curMonth) : null,
      };
    }),
  };
}

export async function saveSession(user, { slotId, date, done, syllabusItemIds = [], note }) {
  const day = parseDay(date);
  const slot = await prisma.scheduleSlot.findUnique({ where: { id: slotId }, include: SLOT_INCLUDE });
  if (!slot) throw new HttpError(404, 'Créneau introuvable');
  if (!done) {
    await prisma.courseSessionLog.deleteMany({ where: { slotId, date: day } });
    return { ok: true, done: false };
  }
  const curMonth = await currentCursusMonth();
  const courses = await prisma.onlineCourse.findMany({
    where: { courseKind: { in: CURSUS_KINDS } },
    include: COURSE_PROGRESS_INCLUDE,
  });
  const course = resolveSlotCourse(slot, courses, curMonth);
  const log = await prisma.courseSessionLog.upsert({
    where: { slotId_date: { slotId, date: day } },
    update: { note: note ?? null, checkedById: user.sub, checkedAt: new Date(), courseId: course?.id ?? null },
    create: {
      slotId, date: day, hours: slotHours(slot.startTime, slot.endTime),
      courseId: course?.id ?? null, note: note ?? null, checkedById: user.sub,
    },
  });
  if (course && syllabusItemIds.length) {
    await prisma.syllabusItem.updateMany({
      where: { id: { in: syllabusItemIds }, courseId: course.id, isDone: false },
      data: { isDone: true, doneAt: new Date(), doneById: user.sub },
    });
  }
  return { ok: true, done: true, log };
}

// ═════════════════════════════════════════════════════════════════════════════
// PASSAGE AU NIVEAU SUPÉRIEUR (validé par le Responsable)
// ═════════════════════════════════════════════════════════════════════════════
export async function passageCandidates(req, { mentionId, level }) {
  if (!mentionId || !level) throw new HttpError(400, 'mentionId et level requis');
  await assertMentionScope(req, mentionId);
  const students = await prisma.studentProfile.findMany({
    where: { status: 'ACTIVE', promotion: { mentionId, level } },
    select: { userId: true, user: { select: PERSON } },
    orderBy: { user: { lastName: 'asc' } },
  });
  const rows = [];
  for (const s of students) {
    const ov = await buildStudentOverview(await getStudentCursusProfile(s.userId));
    rows.push({
      ...ov.student, user: s.user,
      paidCount: ov.paidCount, completedCount: ov.completedCount, eligible: ov.eligibleForPassage,
    });
  }
  const target = nextLevel(level);
  const targetPromotions = target
    ? await prisma.promotion.findMany({
        where: { mentionId, level: target },
        select: { id: true, name: true, level: true },
        orderBy: { createdAt: 'desc' },
      })
    : [];
  return { level, nextLevel: target, targetPromotions, students: rows };
}

export async function promoteStudent(req, studentId, { toPromotionId, note, force }) {
  const profile = await profileByStudentId(studentId);
  await assertMentionScope(req, profile.mentionId);
  const target = await prisma.promotion.findUnique({ where: { id: toPromotionId } });
  if (!target) throw new HttpError(404, 'Promotion cible introuvable');
  if (target.level !== nextLevel(profile.level)) {
    throw new HttpError(400, `La promotion cible doit être de niveau ${nextLevel(profile.level) ?? '—'}`);
  }
  const ov = await buildStudentOverview(profile);
  const staff = await loadStaffContext(req);
  if (!ov.eligibleForPassage && !(force && staff.isAdmin)) {
    throw new HttpError(400, `Étudiant non éligible : ${ov.paidCount}/8 mois payés, ${ov.completedCount}/8 mois terminés.`);
  }
  await prisma.$transaction([
    prisma.studentProfile.update({ where: { id: profile.id }, data: { promotionId: target.id, groupId: null, mentionId: target.mentionId } }),
    prisma.levelPassage.create({
      data: {
        studentId: profile.id, fromLevel: profile.level, toLevel: target.level,
        fromPromotionId: profile.promotion?.id ?? null, toPromotionId: target.id,
        decidedById: req.user.sub, note: note ?? null,
      },
    }),
  ]);
  notifyUser(profile.userId, {
    type: 'SUCCESS',
    title: `Passage en ${target.level} validé 🎓`,
    body: `Félicitations ! Vous êtes inscrit(e) en ${target.name}.`,
    link: '/classroom/cursus',
  }).catch(() => {});
  return { ok: true, toLevel: target.level, promotion: target.name };
}

// ═════════════════════════════════════════════════════════════════════════════
// PARENT — progression de ses enfants
// ═════════════════════════════════════════════════════════════════════════════
export async function parentChildren(user) {
  const parent = await prisma.parentProfile.findUnique({
    where: { userId: user.sub },
    select: { parentLinks: { select: { student: { select: { id: true, userId: true, user: { select: PERSON } } } } } },
  });
  if (!parent) throw new HttpError(403, 'Profil parent requis');
  const since = new Date(Date.now() - 60 * 86_400_000);
  const out = [];
  for (const { student } of parent.parentLinks) {
    const profile = await getStudentCursusProfile(student.userId);
    const [overview, attendance] = await Promise.all([
      buildStudentOverview(profile),
      prisma.attendance.findMany({
        where: { studentId: student.id, date: { gte: since } },
        select: { id: true, date: true, status: true, subject: { select: { name: true } } },
        orderBy: { date: 'desc' },
      }),
    ]);
    const count = (st) => attendance.filter((a) => a.status === st).length;
    out.push({
      student: { ...overview.student, user: student.user },
      cursus: overview,
      attendance: {
        present: count('PRESENT'), absent: count('ABSENT'), late: count('LATE'), excused: count('EXCUSED'),
        recent: attendance.slice(0, 15),
      },
    });
  }
  return out;
}

// ─── Comptes étudiants regroupés par mois (comptabilité) ─────────────────────
// Pour un mois d'écolage donné : chaque étudiant actif avec son statut
// (PAID / PENDING / REFUSED / UNPAID) + compteurs par mois pour les onglets.
export async function tuitionByMonth({ month, mentionId, q, status }) {
  const m = Number(month) || 1;
  const students = await prisma.studentProfile.findMany({
    where: {
      status: 'ACTIVE',
      ...(mentionId && { mentionId }),
      ...(q && {
        OR: [
          { matricule: { contains: q, mode: 'insensitive' } },
          { user: { firstName: { contains: q, mode: 'insensitive' } } },
          { user: { lastName: { contains: q, mode: 'insensitive' } } },
        ],
      }),
    },
    select: {
      id: true, matricule: true,
      user: { select: { firstName: true, lastName: true } },
      mention: { select: { id: true, name: true } },
      promotion: { select: { name: true, level: true } },
    },
    orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
  });
  const payments = await prisma.tuitionPayment.findMany({
    where: { studentId: { in: students.map((s) => s.id) } },
    select: { studentId: true, level: true, month: true, status: true, amount: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  // statut d'un étudiant pour un mois : dernier paiement au niveau actuel
  const statusOf = (s, month) => {
    const p = payments.find((x) => x.studentId === s.id && x.month === month && x.level === (s.promotion?.level ?? x.level));
    if (!p) return { status: 'UNPAID', amount: null };
    return { status: p.status === 'VALIDATED' ? 'PAID' : p.status, amount: p.amount };
  };
  const counts = {};
  for (let k = 1; k <= 8; k++) {
    const c = { PAID: 0, PENDING: 0, REFUSED: 0, UNPAID: 0 };
    students.forEach((s) => { c[statusOf(s, k).status]++; });
    counts[k] = c;
  }
  const items = students
    .map((s) => ({
      studentId: s.id, matricule: s.matricule,
      firstName: s.user.firstName, lastName: s.user.lastName,
      mention: s.mention, promotion: s.promotion,
      ...statusOf(s, m),
    }))
    .filter((s) => !status || s.status === status);
  return { month: m, counts, items };
}

// Détail de l'écolage d'un étudiant (comptabilité / secrétariat)
export async function studentTuitionDetail(studentId) {
  const profile = await profileByStudentId(studentId);
  const user = await prisma.user.findUnique({
    where: { id: profile.userId },
    select: { firstName: true, lastName: true, email: true, phone: true },
  });
  const overview = await buildStudentOverview(profile);
  return { ...overview, student: { ...overview.student, user } };
}
