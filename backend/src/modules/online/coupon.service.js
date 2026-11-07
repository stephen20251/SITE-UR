import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { getCourseOwned, isSuperAdmin } from './online.guards.js';

const round2 = (n) => Math.round(n * 100) / 100;
const norm = (code) => String(code ?? '').trim().toUpperCase();

// ── Validation / discount computation ──
// Validates a code against a course and returns the resulting discount. Throws
// with a French message on any failure so the caller can surface it directly.
export async function validateCoupon(studentId, code, courseId) {
  const coupon = await prisma.coupon.findUnique({ where: { code: norm(code) } });
  if (!coupon || !coupon.isActive) throw new HttpError(404, 'Code promo invalide');
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) throw new HttpError(400, 'Code promo expiré');
  if (coupon.courseId && coupon.courseId !== courseId) throw new HttpError(400, "Ce code ne s'applique pas à ce cours");
  if (coupon.maxRedemptions != null && coupon.redeemedCount >= coupon.maxRedemptions) {
    throw new HttpError(400, 'Ce code promo est épuisé');
  }
  const already = await prisma.couponRedemption.findUnique({
    where: { couponId_studentId_courseId: { couponId: coupon.id, studentId, courseId } },
  });
  if (already) throw new HttpError(400, 'Vous avez déjà utilisé ce code pour ce cours');

  const course = await prisma.onlineCourse.findUnique({ where: { id: courseId }, select: { price: true } });
  const price = course?.price ?? 0;
  let discount = coupon.discountType === 'PERCENT' ? price * (coupon.discountValue / 100) : coupon.discountValue;
  discount = round2(Math.min(Math.max(discount, 0), price));
  return {
    couponId: coupon.id,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    originalPrice: round2(price),
    discountAmount: discount,
    finalPrice: round2(price - discount),
  };
}

// Records a redemption inside a payment-validation transaction (idempotent).
export async function redeemCoupon(tx, code, studentId, courseId) {
  const coupon = await tx.coupon.findUnique({ where: { code: norm(code) }, select: { id: true } });
  if (!coupon) return;
  const existing = await tx.couponRedemption.findUnique({
    where: { couponId_studentId_courseId: { couponId: coupon.id, studentId, courseId } },
  });
  if (existing) return;
  await tx.couponRedemption.create({ data: { couponId: coupon.id, studentId, courseId } });
  await tx.coupon.update({ where: { id: coupon.id }, data: { redeemedCount: { increment: 1 } } });
}

// ── Management (teacher for own courses, admin for anything) ──
export async function createCoupon(userId, { code, courseId, discountType = 'PERCENT', discountValue, maxRedemptions, expiresAt }) {
  const admin = await isSuperAdmin(userId);
  if (courseId) await getCourseOwned(courseId, userId);
  else if (!admin) throw new HttpError(403, 'Seul un administrateur peut créer un code plateforme');

  if (!['PERCENT', 'FIXED'].includes(discountType)) throw new HttpError(400, 'Type de remise invalide');
  const value = Number(discountValue);
  if (!(value > 0)) throw new HttpError(400, 'Valeur de remise invalide');
  if (discountType === 'PERCENT' && value > 100) throw new HttpError(400, 'Le pourcentage ne peut dépasser 100');

  const normCode = norm(code);
  if (normCode.length < 3) throw new HttpError(400, 'Le code doit faire au moins 3 caractères');
  const exists = await prisma.coupon.findUnique({ where: { code: normCode }, select: { id: true } });
  if (exists) throw new HttpError(409, 'Ce code existe déjà');

  return prisma.coupon.create({
    data: {
      code: normCode,
      courseId: courseId ?? null,
      discountType,
      discountValue: value,
      maxRedemptions: maxRedemptions != null ? Number(maxRedemptions) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: userId,
    },
  });
}

export async function listCoupons(userId, { courseId } = {}) {
  const admin = await isSuperAdmin(userId);
  const where = {};
  if (courseId) where.courseId = courseId;
  if (!admin) where.OR = [{ course: { teacherId: userId } }, { createdBy: userId }];
  return prisma.coupon.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { course: { select: { id: true, title: true } }, _count: { select: { redemptions: true } } },
  });
}

async function assertCouponOwner(userId, id) {
  const c = await prisma.coupon.findUnique({ where: { id }, select: { courseId: true, createdBy: true } });
  if (!c) throw new HttpError(404, 'Code promo introuvable');
  if (await isSuperAdmin(userId)) return c;
  if (c.courseId) await getCourseOwned(c.courseId, userId);
  else if (c.createdBy !== userId) throw new HttpError(403, 'Action non autorisée');
  return c;
}

export async function updateCoupon(userId, id, patch) {
  await assertCouponOwner(userId, id);
  const data = {};
  if (patch.isActive !== undefined) data.isActive = Boolean(patch.isActive);
  if (patch.maxRedemptions !== undefined) data.maxRedemptions = patch.maxRedemptions == null ? null : Number(patch.maxRedemptions);
  if (patch.expiresAt !== undefined) data.expiresAt = patch.expiresAt ? new Date(patch.expiresAt) : null;
  return prisma.coupon.update({ where: { id }, data });
}

export async function deleteCoupon(userId, id) {
  await assertCouponOwner(userId, id);
  await prisma.coupon.delete({ where: { id } });
  return { ok: true };
}
