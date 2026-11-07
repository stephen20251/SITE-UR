import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { notifyUser } from '../../utils/notify.js';
import { isSuperAdmin } from './online.guards.js';
import { sendEmail, renderEmail } from '../../utils/mailer.js';

const PLAN_PUBLIC = {
  id: true, name: true, description: true, price: true, currency: true,
  durationDays: true, features: true, scope: true, isFeatured: true, isActive: true,
};

const cleanFeatures = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .map((f) => String(f).trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 10);

const SUB_INCLUDE = {
  plan: { select: { id: true, name: true, durationDays: true, price: true, currency: true } },
  student: { select: { id: true, firstName: true, lastName: true, email: true } },
};

async function requireAdmin(userId) {
  if (!(await isSuperAdmin(userId))) throw new HttpError(403, 'Réservé aux administrateurs');
}

// ── Plans ──
export function listActivePlans() {
  return prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { price: 'asc' }, select: PLAN_PUBLIC });
}

export async function listAllPlans(userId) {
  await requireAdmin(userId);
  return prisma.subscriptionPlan.findMany({
    orderBy: { price: 'asc' },
    include: { _count: { select: { subscriptions: true } } },
  });
}

export async function createPlan(userId, { name, description, price, currency, durationDays, scope, isFeatured, features }) {
  await requireAdmin(userId);
  if (!name?.trim()) throw new HttpError(400, 'Nom requis');
  if (!(Number(price) >= 0)) throw new HttpError(400, 'Prix invalide');
  if (!(Number(durationDays) > 0)) throw new HttpError(400, 'Durée invalide');
  return prisma.subscriptionPlan.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      price: Number(price),
      currency: currency || 'MGA',
      durationDays: Number(durationDays),
      scope: scope || 'ALL',
      isFeatured: Boolean(isFeatured),
      features: cleanFeatures(features),
    },
  });
}

export async function updatePlan(userId, id, patch) {
  await requireAdmin(userId);
  const data = {};
  ['name', 'description', 'scope'].forEach((k) => { if (patch[k] !== undefined) data[k] = patch[k]; });
  if (patch.features !== undefined) data.features = cleanFeatures(patch.features);
  if (patch.price !== undefined) data.price = Number(patch.price);
  if (patch.durationDays !== undefined) data.durationDays = Number(patch.durationDays);
  if (patch.isActive !== undefined) data.isActive = Boolean(patch.isActive);
  if (patch.isFeatured !== undefined) data.isFeatured = Boolean(patch.isFeatured);
  return prisma.subscriptionPlan.update({ where: { id }, data });
}

export async function deletePlan(userId, id) {
  await requireAdmin(userId);
  const count = await prisma.subscription.count({ where: { planId: id } });
  if (count > 0) {
    // Keep history intact — just deactivate.
    return prisma.subscriptionPlan.update({ where: { id }, data: { isActive: false } });
  }
  await prisma.subscriptionPlan.delete({ where: { id } });
  return { ok: true };
}

// ── Access ──
// The student's current usable subscription (ACTIVE and not past expiry).
// Lazily flips a lapsed ACTIVE row to EXPIRED.
export async function activeSubscription(studentId) {
  const sub = await prisma.subscription.findFirst({
    where: { studentId, status: 'ACTIVE' },
    orderBy: { expiresAt: 'desc' },
    include: SUB_INCLUDE,
  });
  if (!sub) return null;
  if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) {
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'EXPIRED' } });
    return null;
  }
  return sub;
}

export async function hasActiveSubscription(studentId) {
  const c = await prisma.subscription.count({
    where: { studentId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
  });
  return c > 0;
}

async function makeReference() {
  const count = await prisma.subscription.count();
  return `SUB-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
}

// ── Subscribe (student) ──
// Instant access: the subscription is ACTIVE immediately (optimistic) while the
// payment awaits admin validation; a refusal revokes it.
export async function subscribe(studentId, { planId, method, senderNumber, transactionRef, screenshotUrl }) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) throw new HttpError(404, 'Offre indisponible');
  if (await hasActiveSubscription(studentId)) throw new HttpError(409, 'Vous avez déjà un abonnement actif');
  if (!method || !senderNumber || !transactionRef) throw new HttpError(400, 'Informations de paiement incomplètes');

  const now = new Date();
  const expiresAt = new Date(now.getTime() + plan.durationDays * 86_400_000);
  const reference = await makeReference();

  return prisma.subscription.create({
    data: {
      studentId, planId,
      status: 'ACTIVE',
      startedAt: now,
      expiresAt,
      method, senderNumber, transactionRef,
      screenshotUrl: screenshotUrl ?? null,
      amount: plan.price,
      reference,
    },
    include: SUB_INCLUDE,
  });
}

export async function mySubscriptions(studentId) {
  return prisma.subscription.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    include: { plan: { select: { id: true, name: true, durationDays: true, price: true, currency: true } } },
  });
}

// ── Admin ──
export async function listSubscriptions(userId, { status, page = 1, limit = 20 } = {}) {
  await requireAdmin(userId);
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.subscription.findMany({ where, include: SUB_INCLUDE, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.subscription.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function validateSubscription(userId, id) {
  await requireAdmin(userId);
  const sub = await prisma.subscription.findUniqueOrThrow({ where: { id }, include: SUB_INCLUDE });
  const updated = await prisma.subscription.update({
    where: { id },
    data: { status: 'ACTIVE', validatedAt: new Date(), validatedBy: userId },
    include: SUB_INCLUDE,
  });
  notifyUser(sub.studentId, {
    type: 'PAYMENT',
    title: 'Abonnement confirmé ✅',
    body: `Votre abonnement « ${sub.plan.name} » est confirmé. Accès illimité à tous les cours !`,
    link: '/online/subscription',
  }).catch(() => {});
  sendEmail({
    to: sub.student.email,
    subject: `👑 Abonnement ${sub.plan.name} confirmé — accès illimité`,
    html: renderEmail({
      title: 'Bienvenue dans UR Online Premium !',
      greeting: `Bonjour ${sub.student.firstName},`,
      body: `Votre abonnement <b>« ${sub.plan.name} »</b> est confirmé${updated.expiresAt ? ` jusqu'au <b>${new Date(updated.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</b>` : ''}.<br/>L'intégralité du catalogue — et tous les nouveaux cours — sont débloqués, certificats inclus.`,
      ctaLabel: 'Explorer le catalogue',
      ctaUrl: '/online',
    }),
  }).catch(() => {});
  return updated;
}

export async function refuseSubscription(userId, id, reason) {
  await requireAdmin(userId);
  const sub = await prisma.subscription.findUniqueOrThrow({ where: { id }, include: SUB_INCLUDE });
  const updated = await prisma.subscription.update({
    where: { id },
    data: { status: 'REFUSED', refusedAt: new Date(), validatedBy: userId, refusedReason: reason ?? null },
    include: SUB_INCLUDE,
  });
  notifyUser(sub.studentId, {
    type: 'PAYMENT',
    title: 'Abonnement refusé',
    body: `Votre abonnement « ${sub.plan.name} » a été refusé.${reason ? ` Motif : ${reason}` : ''} L'accès a été retiré.`,
  }).catch(() => {});
  return updated;
}

export async function subscriptionStats(userId) {
  await requireAdmin(userId);
  const [active, pendingValidation, expired, revenue] = await Promise.all([
    prisma.subscription.count({ where: { status: 'ACTIVE', expiresAt: { gt: new Date() } } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', validatedAt: null } }),
    prisma.subscription.count({ where: { status: 'EXPIRED' } }),
    prisma.subscription.aggregate({ where: { validatedAt: { not: null } }, _sum: { amount: true } }),
  ]);
  return { active, pendingValidation, expired, revenue: revenue._sum.amount ?? 0 };
}
