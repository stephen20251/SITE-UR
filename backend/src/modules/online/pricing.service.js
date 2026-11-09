// Tarifs des cours et packs de cours — gérés exclusivement par le Super Admin.
// Un pack (ex. Java I + II + III) est vendu à un prix différent de la somme des
// cours achetés un par un. L'achat d'un pack crée un paiement par cours (montant
// réparti au prorata du prix unitaire) qui partagent le même packId et la même
// référence de transaction : ils sont validés ou refusés ensemble.
import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';

const PACK_INCLUDE = {
  courses: {
    orderBy: { order: 'asc' },
    include: { course: { select: { id: true, title: true, price: true, thumbnail: true, courseKind: true, status: true } } },
  },
};

function withTotals(pack) {
  const individual = pack.courses.reduce((s, c) => s + (c.course.price ?? 0), 0);
  return { ...pack, individualTotal: individual, saving: Math.max(0, individual - pack.price) };
}

// ── Prix unitaires ──────────────────────────────────────────────────────────
export async function listSellableCourses({ q } = {}) {
  return prisma.onlineCourse.findMany({
    where: {
      courseKind: { in: ['CERTIFYING', 'BOTH'] },
      ...(q && { title: { contains: q } }),
    },
    select: {
      id: true, title: true, price: true, status: true, courseKind: true, thumbnail: true,
      teacher: { select: { firstName: true, lastName: true } },
    },
    orderBy: { title: 'asc' },
  });
}

export async function setCoursePrice(courseId, price) {
  const value = Number(price);
  if (!Number.isFinite(value) || value < 0) throw new HttpError(400, 'Prix invalide');
  const course = await prisma.onlineCourse.findUnique({ where: { id: courseId }, select: { courseKind: true } });
  if (!course) throw new HttpError(404, 'Cours introuvable');
  if (course.courseKind === 'UNIVERSITY') throw new HttpError(400, "Un cours du cursus universitaire est couvert par l'écolage");
  return prisma.onlineCourse.update({ where: { id: courseId }, data: { price: value }, select: { id: true, title: true, price: true } });
}

// ── Packs ───────────────────────────────────────────────────────────────────
export async function listPacks({ courseId, activeOnly } = {}) {
  const packs = await prisma.coursePack.findMany({
    where: {
      ...(activeOnly && { isActive: true }),
      ...(courseId && { courses: { some: { courseId } } }),
    },
    include: PACK_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  return packs.map(withTotals);
}

async function assertCourses(courseIds) {
  if (!Array.isArray(courseIds) || courseIds.length < 2) throw new HttpError(400, 'Un pack doit contenir au moins 2 cours');
  const courses = await prisma.onlineCourse.findMany({ where: { id: { in: courseIds } }, select: { id: true, courseKind: true } });
  if (courses.length !== courseIds.length) throw new HttpError(400, 'Un des cours est introuvable');
  if (courses.some((c) => c.courseKind === 'UNIVERSITY')) throw new HttpError(400, "Les cours du cursus universitaire ne peuvent pas être vendus en pack");
}

export async function createPack({ title, description, price, currency, isActive, courseIds }) {
  if (!title?.trim()) throw new HttpError(400, 'Titre requis');
  if (!(Number(price) >= 0)) throw new HttpError(400, 'Prix invalide');
  await assertCourses(courseIds);
  const pack = await prisma.coursePack.create({
    data: {
      title: title.trim(), description: description ?? null, price: Number(price),
      currency: currency ?? 'MGA', isActive: isActive ?? true,
      courses: { create: courseIds.map((courseId, order) => ({ courseId, order })) },
    },
    include: PACK_INCLUDE,
  });
  return withTotals(pack);
}

export async function updatePack(id, { title, description, price, currency, isActive, courseIds }) {
  const existing = await prisma.coursePack.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Pack introuvable');
  if (courseIds) await assertCourses(courseIds);
  const pack = await prisma.$transaction(async (tx) => {
    if (courseIds) {
      await tx.coursePackCourse.deleteMany({ where: { packId: id } });
      await tx.coursePackCourse.createMany({ data: courseIds.map((courseId, order) => ({ packId: id, courseId, order })) });
    }
    return tx.coursePack.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: Number(price) }),
        ...(currency !== undefined && { currency }),
        ...(isActive !== undefined && { isActive: !!isActive }),
      },
      include: PACK_INCLUDE,
    });
  });
  return withTotals(pack);
}

export async function deletePack(id) {
  await prisma.coursePack.delete({ where: { id } });
}

// ── Achat d'un pack ─────────────────────────────────────────────────────────
async function makeReference(i) {
  const count = await prisma.coursePayment.count();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PACK-${new Date().getFullYear()}-${String(count + 1 + i).padStart(6, '0')}-${rand}`;
}

export async function purchasePack(studentId, packId, { method, senderNumber, transactionRef, remark, screenshotUrl }) {
  if (!method || !senderNumber || !transactionRef) throw new HttpError(400, 'Mode de paiement, numéro et référence requis');
  const pack = await prisma.coursePack.findUnique({ where: { id: packId }, include: PACK_INCLUDE });
  if (!pack || !pack.isActive) throw new HttpError(404, 'Pack indisponible');

  const enrolled = await prisma.enrollment.findMany({
    where: { studentId, courseId: { in: pack.courses.map((c) => c.courseId) } },
    select: { courseId: true },
  });
  const owned = new Set(enrolled.map((e) => e.courseId));
  if (owned.size === pack.courses.length) throw new HttpError(409, 'Vous possédez déjà tous les cours de ce pack');
  if (owned.size) {
    throw new HttpError(409, `Vous êtes déjà inscrit à ${owned.size} cours de ce pack : achetez plutôt les cours restants à l'unité.`);
  }
  const pending = await prisma.coursePayment.findFirst({ where: { studentId, packId, status: 'PENDING' } });
  if (pending) throw new HttpError(409, 'Un paiement est déjà en attente pour ce pack');

  // Répartition du prix du pack au prorata du prix unitaire de chaque cours
  const unit = pack.courses.map((c) => c.course.price ?? 0);
  const total = unit.reduce((s, x) => s + x, 0);
  let remaining = pack.price;
  const amounts = pack.courses.map((_, i) => {
    if (i === pack.courses.length - 1) return Math.round(remaining * 100) / 100;
    const share = total > 0 ? (pack.price * unit[i]) / total : pack.price / pack.courses.length;
    const v = Math.round(share * 100) / 100;
    remaining -= v;
    return v;
  });

  const payments = [];
  for (let i = 0; i < pack.courses.length; i++) {
    const courseId = pack.courses[i].courseId;
    payments.push(await prisma.coursePayment.create({
      data: {
        studentId, courseId, packId, method, senderNumber, transactionRef,
        amount: amounts[i], currency: pack.currency,
        remark: remark ?? `Pack « ${pack.title} »`, screenshotUrl: screenshotUrl ?? null,
        reference: await makeReference(i), status: 'PENDING',
      },
    }));
    // Accès immédiat, retiré si le paiement est refusé (même règle qu'un achat unitaire)
    await prisma.enrollment.upsert({
      where: { studentId_courseId: { studentId, courseId } },
      create: { studentId, courseId },
      update: { viaSubscription: false },
    });
  }
  return { pack: withTotals(pack), payments };
}
