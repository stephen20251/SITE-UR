import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listPublished, publicStats, instructorProfile, featuredInstructors, getCourseDetail } from './courses.service.js';
import { publicHighlights } from './reviews.service.js';
import { prisma } from '../../database/prisma.js';
import {
  getSettings, getNav, getHomeSections, getCategories, listTestimonials, listFaq,
} from './lms-admin.service.js';

const r = Router();

// ── Public catalog endpoints (no auth) ────────────────────────────────────────

r.get('/courses', asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 12));
  const q = req.query.q?.toString() ?? '';
  const categoryId = req.query.categoryId?.toString();
  const validSort = ['recent', 'rating', 'popular'];
  const sort = validSort.includes(req.query.sort) ? req.query.sort : 'recent';
  const validLevel = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
  const level = validLevel.includes(req.query.level) ? req.query.level : undefined;
  const free = req.query.free === 'true';
  const minRating = req.query.minRating != null ? Number(req.query.minRating) : undefined;
  const kind = ['ALL', 'UNIVERSITY', 'CERTIFYING'].includes(req.query.kind) ? req.query.kind : undefined;
  const cursusLevel = ['L1', 'L2', 'L3', 'M1', 'M2'].includes(req.query.cursusLevel) ? req.query.cursusLevel : undefined;
  const mentionId = /^[0-9a-f-]{36}$/i.test(req.query.mentionId ?? '') ? req.query.mentionId : undefined;
  res.json(await listPublished({ page, limit, q, categoryId, sort, level, free, minRating, kind, cursusLevel, mentionId }));
}));

// Page de présentation d'un cours (visiteur non connecté) : contenu verrouillé
// sauf leçons d'aperçu, comme sur un MOOC.
r.get('/courses/:id', asyncHandler(async (req, res) => {
  res.json(await getCourseDetail(req.params.id, { sub: null, role: 'GUEST' }));
}));

// Page d'accueil du site : chiffres clés, facultés et mentions, actualités publiques.
// Seules les annonces publiées pour « tous » sont publiques ; à défaut, les
// derniers cours en ligne publiés servent d'actualités.
r.get('/home', asyncHandler(async (req, res) => {
  const now = new Date();
  const [teachers, teachersOnline, students, learners, onlineCourses, certificates, mentions, faculties, news, latest] = await Promise.all([
    prisma.teacherProfile.count(),
    prisma.user.count({ where: { systemRole: 'TEACHER_ONLINE', isActive: true } }),
    prisma.studentProfile.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { systemRole: 'STUDENT_ONLINE', isActive: true } }),
    prisma.onlineCourse.count({ where: { status: 'PUBLISHED' } }),
    prisma.onlineCertificate.count(),
    prisma.mention.count({ where: { isActive: true } }),
    prisma.faculty.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, code: true,
        departments: { select: { name: true, mentions: { where: { isActive: true }, select: { id: true, name: true, description: true } } } },
      },
    }),
    prisma.announcement.findMany({
      where: { status: 'PUBLISHED', targetAll: true, publishAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      select: { id: true, title: true, content: true, category: true, publishAt: true },
      orderBy: [{ isPinned: 'desc' }, { publishAt: 'desc' }],
      take: 6,
    }),
    prisma.onlineCourse.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, title: true, subtitle: true, description: true, thumbnail: true, publishedAt: true, courseKind: true, category: { select: { name: true } } },
      orderBy: { publishedAt: 'desc' },
      take: 6,
    }),
  ]);
  res.json({
    stats: { teachers: teachers + teachersOnline, students, learners, onlineCourses, certificates, mentions, faculties: faculties.length },
    faculties: faculties.map((f) => ({ id: f.id, name: f.name, code: f.code, mentions: f.departments.flatMap((d) => d.mentions) })),
    news: news.map((n) => ({ ...n, content: n.content.slice(0, 220) })),
    latestCourses: latest,
  });
}));

r.get('/stats', asyncHandler(async (req, res) => {
  res.json(await publicStats());
}));

// ── LMS public config (navbar, settings, homepage data) ──────────────────────

r.get('/settings', asyncHandler(async (req, res) => {
  res.json(await getSettings());
}));

r.get('/nav', asyncHandler(async (req, res) => {
  const items = await getNav();
  res.json(items.filter((i) => i.isActive));
}));

r.get('/home-sections', asyncHandler(async (req, res) => {
  const sections = await getHomeSections();
  res.json(sections.filter((s) => s.isActive));
}));

r.get('/categories', asyncHandler(async (req, res) => {
  res.json(await getCategories());
}));

r.get('/testimonials', asyncHandler(async (req, res) => {
  const items = await listTestimonials();
  res.json(items.filter((t) => t.isActive));
}));

r.get('/faq', asyncHandler(async (req, res) => {
  const items = await listFaq();
  res.json(items.filter((f) => f.isActive));
}));

// Real course reviews for the landing page (social proof)
r.get('/reviews-highlights', asyncHandler(async (req, res) => {
  res.json(await publicHighlights(Math.min(12, Number(req.query.limit) || 6)));
}));

// Featured instructors strip
r.get('/featured-instructors', asyncHandler(async (req, res) => {
  res.json(await featuredInstructors(Math.min(8, Number(req.query.limit) || 4)));
}));

// Public instructor profile page
r.get('/instructors/:id', asyncHandler(async (req, res) => {
  res.json(await instructorProfile(req.params.id));
}));

export default r;
