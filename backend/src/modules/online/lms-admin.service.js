import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { uniqueSlug } from '../../utils/slug.js';
import { hashPassword } from '../../utils/hash.js';
import { generateTempPassword } from '../../utils/password.js';
import { ensureProfile } from '../me/ensure-profile.js';

// ── LMS Settings ──────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  platformName: 'UR Online',
  platformTagline: 'Apprenez n\'importe quoi. De partout.',
  platformDescription: 'Des cours dispensés par des enseignants universitaires.',
  logoUrl: '',
  faviconUrl: '',
  bannerUrl: '',
  bannerSubtitle: '',
  primaryColor: '#6366f1',
  secondaryColor: '#a855f7',
  accentColor: '#3b82f6',
  socialFacebook: '',
  socialTwitter: '',
  socialLinkedin: '',
  socialYoutube: '',
  socialInstagram: '',
  metaTitle: 'UR Online — Apprenez avec l\'université',
  metaDescription: 'Plateforme de cours en ligne de l\'Université Références.',
  metaKeywords: '',
  footerText: '© 2025 Université Références. Tous droits réservés.',
  defaultLanguage: 'fr',
  defaultCurrency: 'MGA',
  timezone: 'Indian/Antananarivo',
  allowRegistration: 'true',
  requireEmailVerification: 'false',
  maintenanceMode: 'false',
  mvolaNom: '',
  mvolaNumero: '',
  orangeMoneyNom: '',
  orangeMoneyNumero: '',
  airtelMoneyNom: '',
  airtelMoneyNumero: '',
};

export async function getSettings() {
  const rows = await prisma.lmsSetting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...map };
}

export async function updateSettings(patch) {
  await Promise.all(
    Object.entries(patch).map(([key, value]) =>
      prisma.lmsSetting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      })
    )
  );
  return getSettings();
}

// ── Navigation ────────────────────────────────────────────────────────────────

export async function getNav() {
  return prisma.navMenu.findMany({
    where: { parentId: null },
    orderBy: { order: 'asc' },
    include: { children: { orderBy: { order: 'asc' } } },
  });
}

export async function createNavItem(data) {
  const count = await prisma.navMenu.count({ where: { parentId: data.parentId ?? null } });
  return prisma.navMenu.create({
    data: {
      label: data.label,
      url: data.url ?? null,
      icon: data.icon ?? null,
      order: data.order ?? count,
      isActive: data.isActive ?? true,
      openInTab: data.openInTab ?? false,
      roles: data.roles ?? [],
      parentId: data.parentId ?? null,
    },
    include: { children: true },
  });
}

export async function updateNavItem(id, patch) {
  return prisma.navMenu.update({
    where: { id },
    data: patch,
    include: { children: { orderBy: { order: 'asc' } } },
  });
}

export async function deleteNavItem(id) {
  await prisma.navMenu.delete({ where: { id } });
}

export async function reorderNav(items) {
  await Promise.all(
    items.map(({ id, order, parentId }) =>
      prisma.navMenu.update({ where: { id }, data: { order, parentId: parentId ?? null } })
    )
  );
  return getNav();
}

// ── Homepage Sections ─────────────────────────────────────────────────────────

const DEFAULT_SECTIONS = [
  { type: 'HERO',        title: 'Héro',           order: 0, isActive: true },
  { type: 'CATEGORIES', title: 'Catégories',      order: 1, isActive: true },
  { type: 'COURSES',    title: 'Cours populaires', order: 2, isActive: true },
  { type: 'TEACHERS',   title: 'Nos enseignants', order: 3, isActive: true },
  { type: 'PATHS',      title: 'Parcours',         order: 4, isActive: false },
  { type: 'LIVE',       title: 'Sessions live',   order: 5, isActive: false },
  { type: 'TESTIMONIALS', title: 'Témoignages',   order: 6, isActive: true },
  { type: 'FAQ',        title: 'FAQ',             order: 7, isActive: true },
];

export async function getHomeSections() {
  let sections = await prisma.homeSection.findMany({ orderBy: { order: 'asc' } });
  if (sections.length === 0) {
    await prisma.homeSection.createMany({ data: DEFAULT_SECTIONS.map(s => ({ ...s, updatedAt: new Date() })) });
    sections = await prisma.homeSection.findMany({ orderBy: { order: 'asc' } });
  }
  return sections;
}

export async function updateHomeSection(id, patch) {
  return prisma.homeSection.update({ where: { id }, data: patch });
}

export async function reorderHomeSections(items) {
  await Promise.all(
    items.map(({ id, order }) => prisma.homeSection.update({ where: { id }, data: { order } }))
  );
  return getHomeSections();
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function getCategories() {
  return prisma.onlineCategory.findMany({
    where: { parentId: null },
    orderBy: { name: 'asc' },
    include: {
      children: { orderBy: { name: 'asc' }, include: { _count: { select: { courses: true } } } },
      _count: { select: { courses: true } },
    },
  });
}

export async function createCategory(data) {
  const slug = data.slug || uniqueSlug(data.name);
  return prisma.onlineCategory.create({
    data: {
      name: data.name,
      slug,
      description: data.description ?? null,
      icon: data.icon ?? null,
      color: data.color ?? null,
      parentId: data.parentId ?? null,
    },
    include: { _count: { select: { courses: true } } },
  });
}

export async function updateCategory(id, patch) {
  if (patch.name && !patch.slug) patch.slug = uniqueSlug(patch.name);
  return prisma.onlineCategory.update({
    where: { id },
    data: patch,
    include: { _count: { select: { courses: true } } },
  });
}

export async function deleteCategory(id) {
  await prisma.onlineCategory.delete({ where: { id } });
}

// ── Courses (Super Admin) ────────────────────────────────────────────────────

export async function adminListCourses({ page = 1, limit = 20, q, status, teacherId, categoryId }) {
  const where = {
    ...(status && { status }),
    ...(teacherId && { teacherId }),
    ...(categoryId && { categoryId }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    }),
  };
  const [items, total] = await Promise.all([
    prisma.onlineCourse.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        publishedAt: true,
        isFeatured: true,
        level: true,
        language: true,
        createdAt: true,
        updatedAt: true,
        teacher: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        category: { select: { id: true, name: true } },
        _count: { select: { modules: true, enrollments: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.onlineCourse.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function adminCreateCourse(data) {
  const slug = uniqueSlug(data.title);
  return prisma.onlineCourse.create({
    data: {
      title: data.title,
      slug,
      description: data.description ?? null,
      thumbnail: data.thumbnail ?? null,
      teacherId: data.teacherId,
      categoryId: data.categoryId ?? null,
      level: data.level ?? null,
      language: data.language ?? 'fr',
      isFeatured: data.isFeatured ?? false,
    },
    select: { id: true, title: true, slug: true, status: true },
  });
}

export async function adminUpdateCourse(id, patch) {
  return prisma.onlineCourse.update({
    where: { id },
    data: patch,
    select: { id: true, title: true, slug: true, status: true, isFeatured: true },
  });
}

export async function adminDeleteCourse(id) {
  await prisma.onlineCourse.delete({ where: { id } });
}

export async function adminDuplicateCourse(id) {
  const src = await prisma.onlineCourse.findUniqueOrThrow({
    where: { id },
    include: { modules: { include: { lessons: true } } },
  });
  const slug = uniqueSlug(`${src.title} copie`);
  return prisma.onlineCourse.create({
    data: {
      title: `${src.title} (copie)`,
      slug,
      description: src.description,
      thumbnail: src.thumbnail,
      teacherId: src.teacherId,
      categoryId: src.categoryId,
      level: src.level,
      language: src.language,
      status: 'DRAFT',
      modules: {
        create: src.modules.map((m) => ({
          title: m.title,
          description: m.description,
          order: m.order,
          lessons: {
            create: m.lessons.map((l) => ({
              title: l.title,
              type: l.type,
              contentUrl: l.contentUrl,
              body: l.body,
              duration: l.duration,
              order: l.order,
            })),
          },
        })),
      },
    },
    select: { id: true, title: true, slug: true, status: true },
  });
}

export async function adminTransferCourse(id, newTeacherId) {
  return prisma.onlineCourse.update({
    where: { id },
    data: { teacherId: newTeacherId },
    select: { id: true, title: true, teacherId: true },
  });
}

// ── Teachers ──────────────────────────────────────────────────────────────────

export async function adminListTeachers({ page = 1, limit = 20, q } = {}) {
  const where = {
    systemRole: { in: ['TEACHER_ONLINE', 'SUPER_ADMIN'] },
    ...(q && {
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    }),
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, firstName: true, lastName: true, email: true,
        avatarUrl: true, systemRole: true, isActive: true, createdAt: true,
        _count: { select: { onlineCourses: true } },
      },
      orderBy: { lastName: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function adminUpdateTeacher(id, patch) {
  return prisma.user.update({
    where: { id },
    data: {
      firstName: patch.firstName,
      lastName: patch.lastName,
      avatarUrl: patch.avatarUrl,
      isActive: patch.isActive,
      systemRole: patch.systemRole,
    },
    select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, systemRole: true, isActive: true },
  });
}

// ── Students ──────────────────────────────────────────────────────────────────

export async function adminListStudents({ page = 1, limit = 20, q } = {}) {
  const where = {
    systemRole: 'STUDENT_ONLINE',
    ...(q && {
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    }),
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, firstName: true, lastName: true, email: true,
        avatarUrl: true, isActive: true, createdAt: true,
        _count: { select: { learningActivities: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total, page, limit };
}

// ── Media Library ─────────────────────────────────────────────────────────────

export async function listMedia({ page = 1, limit = 24, q, type } = {}) {
  const where = {
    ...(type && { type }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { originalName: { contains: q, mode: 'insensitive' } },
      ],
    }),
  };
  const [items, total] = await Promise.all([
    prisma.mediaFile.findMany({
      where,
      select: {
        id: true, name: true, originalName: true, url: true,
        type: true, size: true, mimeType: true, createdAt: true,
        uploader: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.mediaFile.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function createMediaFile(data) {
  return prisma.mediaFile.create({
    data: {
      name: data.name,
      originalName: data.originalName ?? data.name,
      url: data.url,
      type: data.type,
      size: data.size ?? null,
      mimeType: data.mimeType ?? null,
      uploadedBy: data.uploadedBy,
    },
    select: { id: true, name: true, url: true, type: true, size: true, mimeType: true, createdAt: true },
  });
}

export async function updateMediaFile(id, patch) {
  return prisma.mediaFile.update({
    where: { id },
    data: { name: patch.name },
    select: { id: true, name: true, url: true, type: true },
  });
}

export async function deleteMediaFile(id) {
  await prisma.mediaFile.delete({ where: { id } });
}

// ── Testimonials ──────────────────────────────────────────────────────────────

export async function listTestimonials() {
  return prisma.testimonial.findMany({ orderBy: { order: 'asc' } });
}

export async function createTestimonial(data) {
  const count = await prisma.testimonial.count();
  return prisma.testimonial.create({
    data: {
      name: data.name,
      role: data.role ?? null,
      avatar: data.avatar ?? null,
      content: data.content,
      rating: data.rating ?? 5,
      isActive: data.isActive ?? true,
      order: data.order ?? count,
    },
  });
}

export async function updateTestimonial(id, patch) {
  return prisma.testimonial.update({ where: { id }, data: patch });
}

export async function deleteTestimonial(id) {
  await prisma.testimonial.delete({ where: { id } });
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

export async function listFaq() {
  return prisma.faqItem.findMany({ orderBy: { order: 'asc' } });
}

export async function createFaqItem(data) {
  const count = await prisma.faqItem.count();
  return prisma.faqItem.create({
    data: {
      question: data.question,
      answer: data.answer,
      isActive: data.isActive ?? true,
      order: data.order ?? count,
    },
  });
}

export async function updateFaqItem(id, patch) {
  return prisma.faqItem.update({ where: { id }, data: patch });
}

export async function deleteFaqItem(id) {
  await prisma.faqItem.delete({ where: { id } });
}

// ── Dashboard Analytics ───────────────────────────────────────────────────────

export async function adminDashboard() {
  const [courses, students, teachers, enrollments, certificates, published, draft, archived] = await Promise.all([
    prisma.onlineCourse.count(),
    prisma.user.count({ where: { systemRole: 'STUDENT_ONLINE' } }),
    prisma.user.count({ where: { systemRole: 'TEACHER_ONLINE' } }),
    prisma.enrollment.count(),
    prisma.onlineCertificate.count(),
    prisma.onlineCourse.count({ where: { status: 'PUBLISHED' } }),
    prisma.onlineCourse.count({ where: { status: 'DRAFT' } }),
    prisma.onlineCourse.count({ where: { status: 'ARCHIVED' } }),
  ]);

  const recentEnrollments = await prisma.enrollment.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      progress: true,
      course: { select: { title: true } },
    },
  });

  return {
    courses, students, teachers, enrollments, certificates,
    coursesByStatus: { published, draft, archived },
    recentEnrollments,
  };
}

// ── User Management ──────────────────────────────────────────────────────────


const USER_FIELDS = {
  id: true, firstName: true, lastName: true, email: true,
  avatarUrl: true, systemRole: true, isActive: true,
  lastLoginAt: true, createdAt: true,
};

export async function adminListUsers({ page = 1, limit = 20, q, role, status } = {}) {
  const where = {
    systemRole: role
      ? role
      : { in: ['STUDENT_ONLINE', 'TEACHER_ONLINE', 'SUPER_ADMIN'] },
    ...(status === 'active'   && { isActive: true }),
    ...(status === 'inactive' && { isActive: false }),
    ...(q && {
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName:  { contains: q, mode: 'insensitive' } },
        { email:     { contains: q, mode: 'insensitive' } },
      ],
    }),
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where, select: USER_FIELDS,
      skip: (page - 1) * limit, take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function adminCreateUser({ firstName, lastName, email, systemRole }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, 'Email déjà utilisé');

  const temp = generateTempPassword();

  const user = await prisma.user.create({
    data: { firstName, lastName, email, passwordHash: await hashPassword(temp), systemRole },
    select: USER_FIELDS,
  });
  await ensureProfile(user.id, systemRole);
  return { ...user, tempPassword: temp };
}

export async function adminUpdateUser(id, { firstName, lastName, systemRole, isActive }) {
  const data = {};
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName  !== undefined) data.lastName  = lastName;
  if (systemRole !== undefined) data.systemRole = systemRole;
  if (isActive   !== undefined) data.isActive   = isActive;
  return prisma.user.update({ where: { id }, data, select: USER_FIELDS });
}

export async function adminToggleActive(id) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id }, select: { isActive: true } });
  return prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
    select: USER_FIELDS,
  });
}

export async function adminResetPassword(id) {
  const temp = generateTempPassword();
  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(temp) } });
  return { tempPassword: temp };
}

export async function adminDeleteUser(id) {
  await prisma.user.update({ where: { id }, data: { isActive: false } });
}

// ─── Certificates registry (admin) ───────────────────────────────────────────
export async function adminListCertificates({ page = 1, limit = 20, q } = {}) {
  const where = q
    ? {
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { course: { title: { contains: q, mode: 'insensitive' } } },
        ],
      }
    : {};
  const [certs, total] = await Promise.all([
    prisma.onlineCertificate.findMany({
      where,
      orderBy: { issuedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        course: { select: { id: true, title: true } },
        enrollment: { select: { progress: true } },
      },
    }),
    prisma.onlineCertificate.count({ where }),
  ]);
  // OnlineCertificate stores a bare studentId — resolve names in one query.
  const students = await prisma.user.findMany({
    where: { id: { in: [...new Set(certs.map((c) => c.studentId))] } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  const byId = new Map(students.map((s) => [s.id, s]));
  const items = certs.map((c) => ({
    id: c.id,
    code: c.code,
    issuedAt: c.issuedAt,
    progress: c.enrollment?.progress ?? null,
    course: c.course,
    student: byId.get(c.studentId) ?? { id: c.studentId, firstName: '?', lastName: '', email: '' },
  }));
  return { items, total, page, limit };
}

// ─── Live sessions registry (admin) ──────────────────────────────────────────
export async function adminListLiveSessions({ page = 1, limit = 20, q } = {}) {
  const where = q
    ? {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { course: { title: { contains: q, mode: 'insensitive' } } },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    prisma.liveSession.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        course: { select: { id: true, title: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.liveSession.count({ where }),
  ]);
  return { items, total, page, limit };
}

// ─── Announcements registry (admin) ──────────────────────────────────────────
export async function adminListAnnouncements({ page = 1, limit = 20, q } = {}) {
  const where = q
    ? {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { course: { title: { contains: q, mode: 'insensitive' } } },
        ],
      }
    : {};
  const [rows, total] = await Promise.all([
    prisma.courseAnnouncement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { course: { select: { id: true, title: true } } },
    }),
    prisma.courseAnnouncement.count({ where }),
  ]);
  const authors = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.authorId))] } },
    select: { id: true, firstName: true, lastName: true },
  });
  const byId = new Map(authors.map((a) => [a.id, a]));
  return {
    items: rows.map((r) => ({ ...r, author: byId.get(r.authorId) ?? null })),
    total, page, limit,
  };
}

export async function adminDeleteAnnouncement(id) {
  await prisma.courseAnnouncement.delete({ where: { id } });
  return { ok: true };
}

// ─── Reviews moderation (admin) ──────────────────────────────────────────────
export async function adminListReviews({ page = 1, limit = 20, q, hidden } = {}) {
  const where = {
    ...(hidden === true ? { isHidden: true } : hidden === false ? { isHidden: false } : {}),
    ...(q && {
      OR: [
        { comment: { contains: q, mode: 'insensitive' } },
        { course: { title: { contains: q, mode: 'insensitive' } } },
        { student: { firstName: { contains: q, mode: 'insensitive' } } },
        { student: { lastName: { contains: q, mode: 'insensitive' } } },
      ],
    }),
  };
  const [items, total] = await Promise.all([
    prisma.courseReview.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        course: { select: { id: true, title: true } },
      },
    }),
    prisma.courseReview.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function adminSetReviewHidden(id, isHidden) {
  return prisma.courseReview.update({ where: { id }, data: { isHidden: Boolean(isHidden) } });
}

export async function adminDeleteReview(id) {
  await prisma.courseReview.delete({ where: { id } });
  return { ok: true };
}
