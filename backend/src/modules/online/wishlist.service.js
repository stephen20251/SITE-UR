import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { ratingsForCourses } from './reviews.service.js';

const TEACHER_CARD = { id: true, firstName: true, lastName: true, avatarUrl: true };

// Card shape mirroring the catalogue so the wishlist can render course tiles.
const courseCard = {
  id: true, title: true, subtitle: true, slug: true, description: true,
  thumbnail: true, status: true, publishedAt: true, level: true, language: true,
  isFeatured: true, tags: true, hasCertificate: true, estimatedHours: true, price: true,
  createdAt: true, updatedAt: true,
  teacher: { select: TEACHER_CARD },
  category: { select: { id: true, name: true, icon: true, color: true } },
  _count: { select: { modules: true, enrollments: true, quizzes: true } },
};

export async function listWishlist(studentId) {
  const rows = await prisma.wishlist.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, course: { select: courseCard } },
  });
  const courses = rows.map((r) => r.course);
  const map = await ratingsForCourses(courses.map((c) => c.id));
  return courses.map((c) => ({ ...c, ratingAvg: map[c.id]?.avg ?? 0, ratingCount: map[c.id]?.count ?? 0 }));
}

// Just the course ids — used to paint the heart state on catalogue cards.
export async function wishlistIds(studentId) {
  const rows = await prisma.wishlist.findMany({ where: { studentId }, select: { courseId: true } });
  return rows.map((r) => r.courseId);
}

export async function toggleWishlist(studentId, courseId) {
  const course = await prisma.onlineCourse.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) throw new HttpError(404, 'Course not found');
  const existing = await prisma.wishlist.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.wishlist.delete({ where: { id: existing.id } });
    return { inWishlist: false };
  }
  await prisma.wishlist.create({ data: { studentId, courseId } });
  return { inWishlist: true };
}
