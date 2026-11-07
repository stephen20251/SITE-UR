import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { notifyUser } from '../../utils/notify.js';
import { getCourseOwned, getEnrollmentOrThrow, isSuperAdmin } from './online.guards.js';

const round2 = (n) => Math.round(n * 100) / 100;
const USER_CARD = { id: true, firstName: true, lastName: true, avatarUrl: true };

const reviewShape = {
  id: true,
  rating: true,
  comment: true,
  reply: true,
  repliedAt: true,
  isHidden: true,
  createdAt: true,
  student: { select: USER_CARD },
};

// ─── Aggregates ───
// Rating summary (avg + count + 1..5 distribution) for a single course.
export async function ratingSummary(courseId) {
  const [agg, buckets] = await Promise.all([
    prisma.courseReview.aggregate({
      where: { courseId, isHidden: false },
      _avg: { rating: true },
      _count: true,
    }),
    prisma.courseReview.groupBy({
      by: ['rating'],
      where: { courseId, isHidden: false },
      _count: true,
    }),
  ]);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const b of buckets) distribution[b.rating] = b._count;
  return { avg: round2(agg._avg.rating ?? 0), count: agg._count, distribution };
}

// Bulk rating map for course lists (catalogue cards). Returns { courseId: {avg,count} }.
export async function ratingsForCourses(courseIds) {
  if (!courseIds.length) return {};
  const rows = await prisma.courseReview.groupBy({
    by: ['courseId'],
    where: { courseId: { in: courseIds }, isHidden: false },
    _avg: { rating: true },
    _count: true,
  });
  const map = {};
  for (const r of rows) map[r.courseId] = { avg: round2(r._avg.rating ?? 0), count: r._count };
  return map;
}

// ─── Read ───
export async function listReviews(courseId, { page = 1, limit = 20 } = {}) {
  const where = { courseId, isHidden: false };
  const [items, total, summary] = await Promise.all([
    prisma.courseReview.findMany({
      where,
      select: reviewShape,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.courseReview.count({ where }),
    ratingSummary(courseId),
  ]);
  return { items, total, page, limit, summary };
}

export async function myReview(studentId, courseId) {
  return prisma.courseReview.findUnique({
    where: { courseId_studentId: { courseId, studentId } },
    select: reviewShape,
  });
}

// ─── Write (student) ───
export async function upsertReview(studentId, courseId, { rating, comment }) {
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) throw new HttpError(400, 'La note doit être comprise entre 1 et 5');
  // Only enrolled students may review.
  await getEnrollmentOrThrow(studentId, courseId);
  const course = await prisma.onlineCourse.findUnique({
    where: { id: courseId },
    select: { title: true, teacherId: true },
  });
  if (!course) throw new HttpError(404, 'Course not found');

  const existing = await prisma.courseReview.findUnique({
    where: { courseId_studentId: { courseId, studentId } },
    select: { id: true },
  });

  const review = await prisma.courseReview.upsert({
    where: { courseId_studentId: { courseId, studentId } },
    create: { courseId, studentId, rating: r, comment: comment?.trim() || null },
    update: { rating: r, comment: comment?.trim() || null },
    select: reviewShape,
  });

  // Notify the teacher only on the first submission (not on edits).
  if (!existing) {
    notifyUser(course.teacherId, {
      type: 'INFO',
      title: 'Nouvel avis sur votre cours ⭐',
      body: `Un étudiant a laissé un avis (${r}/5) sur « ${course.title} ».`,
      link: `/online/studio/${courseId}`,
    }).catch(() => {});
  }
  return review;
}

export async function deleteMyReview(studentId, courseId) {
  const existing = await prisma.courseReview.findUnique({
    where: { courseId_studentId: { courseId, studentId } },
    select: { id: true },
  });
  if (!existing) throw new HttpError(404, 'Aucun avis à supprimer');
  await prisma.courseReview.delete({ where: { id: existing.id } });
  return { ok: true };
}

// ─── Write (teacher / admin) ───
export async function replyToReview(userId, reviewId, reply) {
  const review = await prisma.courseReview.findUnique({
    where: { id: reviewId },
    select: { id: true, courseId: true, studentId: true, course: { select: { title: true } } },
  });
  if (!review) throw new HttpError(404, 'Avis introuvable');
  await getCourseOwned(review.courseId, userId); // owner or super admin
  const updated = await prisma.courseReview.update({
    where: { id: reviewId },
    data: { reply: reply?.trim() || null, repliedAt: reply?.trim() ? new Date() : null },
    select: reviewShape,
  });
  if (reply?.trim()) {
    notifyUser(review.studentId, {
      type: 'INFO',
      title: 'Réponse à votre avis 💬',
      body: `L'enseignant a répondu à votre avis sur « ${review.course.title} ».`,
      link: `/online/course/${review.courseId}`,
    }).catch(() => {});
  }
  return updated;
}

// Best real reviews across the catalogue — social proof for the landing page.
export async function publicHighlights(limit = 6) {
  const reviews = await prisma.courseReview.findMany({
    where: { isHidden: false, rating: { gte: 4 }, comment: { not: null }, course: { status: 'PUBLISHED' } },
    orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: {
      student: { select: { firstName: true, lastName: true, avatarUrl: true } },
      course: { select: { id: true, title: true } },
    },
  });
  return reviews
    .filter((r) => (r.comment ?? '').trim().length >= 8)
    .map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      studentName: `${r.student.firstName} ${(r.student.lastName?.[0] ?? '').toUpperCase()}.`,
      avatarUrl: r.student.avatarUrl,
      courseId: r.course.id,
      courseTitle: r.course.title,
      createdAt: r.createdAt,
    }));
}

export async function setReviewHidden(userId, reviewId, isHidden) {
  const review = await prisma.courseReview.findUnique({
    where: { id: reviewId },
    select: { id: true, courseId: true },
  });
  if (!review) throw new HttpError(404, 'Avis introuvable');
  const admin = await isSuperAdmin(userId);
  if (!admin) await getCourseOwned(review.courseId, userId);
  return prisma.courseReview.update({
    where: { id: reviewId },
    data: { isHidden: Boolean(isHidden) },
    select: reviewShape,
  });
}
