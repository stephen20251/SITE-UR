import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { uniqueSlug } from '../../utils/slug.js';
import { broadcast } from '../../realtime/events.js';
import { getCourseOwned } from './online.guards.js';
import { ratingsForCourses, ratingSummary } from './reviews.service.js';
import { hasActiveSubscription } from './subscription.service.js';
import { isOnlineStudent, isOnlineTeacher } from '../../middlewares/auth.js';
import { canReviewCourse, courseMentionId } from './course-review.service.js';
import {
  cursusAccess, isProtectedCourse, isReservedVideoLesson, isVideoFile, isVideoLesson, quizAudiences, signMediaUrl, CURSUS_KINDS, CERTIFYING_KINDS,
} from '../cursus/cursus.access.js';

const round2 = (n) => Math.round(n * 100) / 100;

// Attach { ratingAvg, ratingCount } to a list of course cards in one query.
async function withRatings(items) {
  const map = await ratingsForCourses(items.map((c) => c.id));
  return items.map((c) => ({
    ...c,
    ratingAvg: map[c.id]?.avg ?? 0,
    ratingCount: map[c.id]?.count ?? 0,
  }));
}

const TEACHER_CARD = { id: true, firstName: true, lastName: true, avatarUrl: true };

// Shape used for course cards in lists.
const courseCard = {
  id: true,
  title: true,
  subtitle: true,
  slug: true,
  description: true,
  thumbnail: true,
  previewVideoUrl: true,
  status: true,
  publishedAt: true,
  level: true,
  isFeatured: true,
  language: true,
  tags: true,
  hasCertificate: true,
  estimatedHours: true,
  objectives: true,
  skills: true,
  audience: true,
  prerequisites: true,
  price: true,
  courseKind: true,
  credentialType: true,
  cursusLevel: true,
  cursusMonth: true,
  mentionId: true,
  totalHours: true,
  createdAt: true,
  updatedAt: true,
  teacher: { select: TEACHER_CARD },
  category: { select: { id: true, name: true, icon: true, color: true } },
  _count: { select: { modules: true, enrollments: true, quizzes: true } },
};

export async function publicStats() {
  const [courses, students, certificates] = await Promise.all([
    prisma.onlineCourse.count({ where: { status: 'PUBLISHED' } }),
    prisma.user.count({ where: { systemRole: 'STUDENT_ONLINE', isActive: true } }),
    prisma.onlineCertificate.count(),
  ]);
  return { courses, students, certificates };
}

// Cohérence des champs du cursus selon le type de cours.
async function normalizeCursusFields(input, current = {}) {
  const kind = input.courseKind ?? current.courseKind ?? 'CERTIFYING';
  const out = {};
  if (kind === 'CERTIFYING') {
    if (input.courseKind) Object.assign(out, { cursusLevel: null, cursusMonth: null, relatedCourseIds: [] });
    return out;
  }
  const level = input.cursusLevel !== undefined ? input.cursusLevel : current.cursusLevel;
  const month = input.cursusMonth !== undefined ? input.cursusMonth : current.cursusMonth;
  if (!level || !month) {
    throw new HttpError(400, 'Un cours du cursus universitaire doit préciser le niveau (L1…) et le mois (1 à 8).');
  }
  if (input.relatedCourseIds?.length) {
    const n = await prisma.onlineCourse.count({ where: { id: { in: input.relatedCourseIds } } });
    if (n !== input.relatedCourseIds.length) throw new HttpError(400, 'Un des cours liés est introuvable.');
  }
  return out;
}

export async function createCourse(teacherId, input) {
  // Cours créé depuis une attribution du plan de cursus : on reprend ses infos.
  let entry = null;
  if (input.curriculumEntryId) {
    entry = await prisma.curriculumEntry.findUnique({ where: { id: input.curriculumEntryId } });
    if (!entry) throw new HttpError(404, 'Attribution du cursus introuvable');
    if (entry.teacherId !== teacherId) throw new HttpError(403, "Ce cours du cursus ne vous est pas attribué");
    if (entry.courseId) throw new HttpError(409, 'Un cours existe déjà pour cette attribution');
    input = {
      ...input,
      courseKind: input.courseKind && input.courseKind !== 'CERTIFYING' ? input.courseKind : 'UNIVERSITY',
      mentionId: entry.mentionId, cursusLevel: entry.level, cursusMonth: entry.month,
      subjectId: entry.subjectId, totalHours: input.totalHours ?? entry.plannedHours,
    };
  }
  const fixes = await normalizeCursusFields(input);
  const course = await prisma.onlineCourse.create({
    data: {
      courseKind:       input.courseKind ?? 'CERTIFYING',
      credentialType:   input.credentialType ?? 'CERTIFICATE',
      // Mention du cours (oriente la validation vers son Responsable) : celle de l'enseignant par défaut
      mentionId:        input.mentionId ?? await courseMentionId({ mentionId: null, teacherId }),
      cursusLevel:      input.cursusLevel ?? null,
      cursusMonth:      input.cursusMonth ?? null,
      subjectId:        input.subjectId ?? null,
      relatedCourseIds: input.relatedCourseIds ?? [],
      totalHours:       input.totalHours ?? null,
      price:            0, // fixé ensuite par le Super Admin (Tarifs & packs)
      ...fixes,
      title:          input.title,
      subtitle:       input.subtitle ?? null,
      slug:           uniqueSlug(input.title),
      description:    input.description ?? null,
      thumbnail:      input.thumbnail ?? null,
      language:       input.language ?? 'fr',
      level:          input.level ?? null,
      categoryId:     input.categoryId ?? null,
      tags:           input.tags ?? [],
      hasCertificate: input.hasCertificate ?? true,
      estimatedHours: input.estimatedHours ?? null,
      teacherId,
    },
    select: courseCard,
  });
  if (entry) await prisma.curriculumEntry.update({ where: { id: entry.id }, data: { courseId: course.id } });
  return course;
}

export async function listPublished({ page, limit, q, categoryId, sort = 'recent', level, free, minRating, kind, cursusLevel, mentionId }) {
  // Catalogue en deux parties, ouvertes à tous : cours certifiants et cursus
  // universitaire. kind = ALL pour tout afficher (par défaut : certifiants).
  const kinds = kind === 'ALL' ? ['UNIVERSITY', 'CERTIFYING', 'BOTH']
    : kind === 'UNIVERSITY' ? CURSUS_KINDS
    : CERTIFYING_KINDS;
  const where = {
    status: 'PUBLISHED',
    courseKind: { in: kinds },
    ...(cursusLevel && { cursusLevel }),
    ...(mentionId && { mentionId }),
    ...(categoryId && { categoryId }),
    ...(level && { level }),
    ...(free === true && { OR: [{ price: 0 }, { price: null }] }),
    ...(q && {
      AND: [{
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      }],
    }),
  };

  // "popular" and "recent" sort at the DB level; "rating" (and any minRating
  // filter) needs the computed average, so those are resolved in JS after
  // attaching ratings. Catalogue size stays modest, so this is fine.
  const needsRatingPass = sort === 'rating' || minRating != null;
  const dbOrder = kinds === CURSUS_KINDS
    ? [{ cursusLevel: 'asc' }, { cursusMonth: 'asc' }, { title: 'asc' }]
    : sort === 'popular' ? { enrollments: { _count: 'desc' } } : { publishedAt: 'desc' };

  if (!needsRatingPass) {
    const [rows, total] = await Promise.all([
      prisma.onlineCourse.findMany({
        where, select: courseCard, orderBy: dbOrder,
        skip: (page - 1) * limit, take: limit,
      }),
      prisma.onlineCourse.count({ where }),
    ]);
    return { items: await withRatings(rows), total, page, limit };
  }

  // Rating-aware path: pull the filtered set (capped), rank, then paginate.
  const rows = await withRatings(
    await prisma.onlineCourse.findMany({ where, select: courseCard, orderBy: dbOrder, take: 300 })
  );
  let ranked = rows;
  if (minRating != null) ranked = ranked.filter((c) => (c.ratingAvg ?? 0) >= minRating);
  if (sort === 'rating') {
    ranked = [...ranked].sort((a, b) => (b.ratingAvg - a.ratingAvg) || (b.ratingCount - a.ratingCount));
  }
  const total = ranked.length;
  const items = ranked.slice((page - 1) * limit, (page - 1) * limit + limit);
  return { items, total, page, limit };
}

export async function listMine(teacherId, { page, limit, q, status }) {
  const where = {
    teacherId,
    ...(status && { status }),
    ...(q && { title: { contains: q, mode: 'insensitive' } }),
  };
  const [items, total] = await Promise.all([
    prisma.onlineCourse.findMany({
      where,
      select: courseCard,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.onlineCourse.count({ where }),
  ]);
  return { items, total, page, limit };
}

// Full course tree. Content is "locked" (urls/body withheld) for viewers who are
// neither the owning teacher nor an enrolled student — a public preview.
export async function getCourseDetail(courseId, user, { asReviewer = false } = {}) {
  const course = await prisma.onlineCourse.findUnique({
    where: { id: courseId },
    include: {
      teacher: { select: TEACHER_CARD },
      category: { select: { id: true, name: true, icon: true, color: true } },
      modules: {
        orderBy: { order: 'asc' },
        include: { lessons: { orderBy: { order: 'asc' }, include: { files: { orderBy: { order: 'asc' } } } } },
      },
      quizzes: {
        select: {
          id: true,
          title: true,
          description: true,
          passingScore: true,
          timeLimit: true,
          audience: true,
          _count: { select: { questions: true } },
        },
      },
      _count: { select: { enrollments: true } },
    },
  });
  if (!course) throw new HttpError(404, 'Course not found');

  const isOwner = asReviewer || (isOnlineTeacher(user) && course.teacherId === user.sub)
    || user.role === 'SUPER_ADMIN' || user.systemRole === 'SUPER_ADMIN';
  if (course.status !== 'PUBLISHED' && !isOwner) throw new HttpError(404, 'Course not found');

  // Cursus universitaire : l'accès vient de l'écolage du mois, pas d'un achat.
  const cursus = isOwner ? { applies: false } : await cursusAccess(user, course);

  let enrollment = null;
  let subscribed = false;
  if (isOnlineStudent(user)) {
    enrollment = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: user.sub, courseId } },
      include: { lessonProgress: true, certificate: { select: { id: true, code: true, issuedAt: true } } },
    });
    // L'abonnement ne débloque pas le cursus universitaire.
    subscribed = !cursus.applies && await hasActiveSubscription(user.sub);
    if (!enrollment && cursus.applies && cursus.accessible) {
      enrollment = await prisma.enrollment.create({
        data: { studentId: user.sub, courseId },
        include: { lessonProgress: true, certificate: { select: { id: true, code: true, issuedAt: true } } },
      });
    }
    // An active subscription grants access to every published course. Auto-enroll
    // the subscriber so progress/certificates work — but flag it so access is
    // gated on the live subscription (a lapse must not leave permanent access).
    if (!enrollment && subscribed && course.status === 'PUBLISHED') {
      await prisma.enrollment.create({ data: { studentId: user.sub, courseId, viaSubscription: true } });
      enrollment = await prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: user.sub, courseId } },
        include: { lessonProgress: true, certificate: { select: { id: true, code: true, issuedAt: true } } },
      });
    }
    // Track last visit
    if (enrollment) {
      prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { lastVisitedAt: new Date() },
      }).catch(() => {});
    }
  }

  const [rating, myReview] = await Promise.all([
    ratingSummary(courseId),
    isOnlineStudent(user)
      ? prisma.courseReview.findUnique({
          where: { courseId_studentId: { courseId, studentId: user.sub } },
          select: { id: true, rating: true, comment: true, reply: true, repliedAt: true, createdAt: true },
        })
      : Promise.resolve(null),
  ]);

  // Access = owner, a live subscription, or a *purchased/free* enrollment. A
  // subscription-only enrollment (viaSubscription) grants access ONLY while the
  // subscription is active, so a lapse can't leave permanent free access.
  const accessible = isOwner || (cursus.applies
    ? cursus.accessible
    : subscribed || Boolean(enrollment && !enrollment.viaSubscription));
  // Cours du cursus : contenu non téléchargeable, servi par liens signés.
  const protectedContent = isProtectedCourse(course);
  const cursusMode = Boolean(cursus.applies && cursus.inCursus);
  // Étudiant en présentiel : vidéos fermées. Étudiant en ligne : il peut télécharger
  // les supports autorisés par l'enseignant (jamais les vidéos).
  const videosReserved = Boolean(!isOwner && cursus.applies && cursus.videosReserved);
  const onlineCursusStudent = Boolean(!isOwner && cursus.applies && cursus.accessible && cursus.studyMode === 'EN_LIGNE');
  const canDownload = (allowDownload, isVideo) => (protectedContent
    ? onlineCursusStudent && allowDownload !== false && !isVideo
    : (allowDownload ?? true));
  const mediaUrl = (url, kind, id, allowDownload, isVideo) => {
    if (!url || !url.startsWith('/uploads/')) return url;
    if (!protectedContent && allowDownload !== false) return url;
    return signMediaUrl(user.sub, kind, id, { download: canDownload(allowDownload, isVideo) });
  };

  // lessonProgress is now OnlineLessonProgress with enrollmentId
  const completedByLesson = new Map((enrollment?.lessonProgress ?? []).map((p) => [p.lessonId, p.completed]));
  const watchedByLesson = new Map((enrollment?.lessonProgress ?? []).map((p) => [p.lessonId, p.watchedSec ?? 0]));

  // ── Drip & prerequisite gating (enrolled students only; owner bypasses) ──
  const now = Date.now();
  const enrolledAt = enrollment ? new Date(enrollment.createdAt).getTime() : null;
  const moduleTitle = new Map(course.modules.map((m) => [m.id, m.title]));
  // A module counts as "completed" when all its visible lessons are done.
  const moduleCompleted = new Map(
    course.modules.map((m) => {
      // Une vidéo fermée à l'étudiant ne peut pas bloquer le module suivant.
      const visible = m.lessons.filter((l) => !l.isHidden && !(videosReserved && isReservedVideoLesson(l)));
      return [m.id, visible.every((l) => completedByLesson.get(l.id)) && (visible.length > 0 || videosReserved)];
    })
  );

  function moduleGate(m) {
    // Drip/prerequisites apply only to purchased/free enrollments — owners and
    // subscribers get everything unlocked.
    if (isOwner || subscribed || !enrollment || enrollment.viaSubscription) return { locked: false };
    if (m.dripDays && enrolledAt != null) {
      const availableAt = enrolledAt + m.dripDays * 86_400_000;
      if (now < availableAt) return { locked: true, reason: 'drip', availableAt: new Date(availableAt).toISOString() };
    }
    if (m.prerequisiteModuleId && !moduleCompleted.get(m.prerequisiteModuleId)) {
      return {
        locked: true,
        reason: 'prerequisite',
        prerequisiteModuleId: m.prerequisiteModuleId,
        prerequisiteTitle: moduleTitle.get(m.prerequisiteModuleId) ?? null,
      };
    }
    return { locked: false };
  }

  const modules = course.modules.map((m) => {
    const gate = moduleGate(m);
    return {
      id: m.id,
      title: m.title,
      description: m.description ?? null,
      order: m.order,
      isHidden: m.isHidden ?? false,
      locked: gate.locked,
      lockReason: gate.reason ?? null,
      availableAt: gate.availableAt ?? null,
      dripDays: m.dripDays ?? null,
      prerequisiteModuleId: m.prerequisiteModuleId ?? null,
      prerequisiteTitle: gate.prerequisiteTitle ?? null,
      lessons: m.lessons.map((l) => {
        // Owner: all unlocked. Accessible (enrolled/subscribed): follows module
        // gate. Otherwise only free-preview lessons are viewable.
        const reservedVideo = videosReserved && isReservedVideoLesson(l);
        const files = (l.files ?? []).filter((f) => !(videosReserved && !l.isPreview && isVideoFile(f)));
        // Vidéo fermée : la leçon reste ouverte si elle contient aussi un texte ou un document.
        const onlineOnly = reservedVideo && files.length === 0 && !l.body;
        const lessonUnlocked = !onlineOnly && (isOwner ? true : accessible ? !gate.locked : Boolean(l.isPreview));
        const videoLesson = isVideoLesson(l);
        return {
          id: l.id,
          title: l.title,
          type: l.type,
          duration: l.duration,
          order: l.order,
          isPreview: l.isPreview ?? false,
          locked: !lessonUnlocked,
          onlineOnly: reservedVideo,
          contentUrl: lessonUnlocked && !reservedVideo ? mediaUrl(l.contentUrl, 'l', l.id, l.allowDownload, videoLesson) : null,
          body: lessonUnlocked ? l.body : null,
          allowDownload: canDownload(l.allowDownload, videoLesson),
          files: lessonUnlocked ? files.map(f => ({
            id: f.id, name: f.name, mimeType: f.mimeType, size: f.size,
            url: mediaUrl(f.url, 'f', f.id, f.allowDownload, isVideoFile(f)),
            allowDownload: canDownload(f.allowDownload, isVideoFile(f)),
          })) : [],
          completed: completedByLesson.get(l.id) ?? false,
          watchedSec: watchedByLesson.get(l.id) ?? 0,
        };
      }),
    };
  });

  return {
    id: course.id,
    title: course.title,
    subtitle: course.subtitle,
    slug: course.slug,
    description: course.description,
    thumbnail: course.thumbnail,
    previewVideoUrl: videosReserved ? null : course.previewVideoUrl,
    status: course.status,
    publishedAt: course.publishedAt,
    level: course.level,
    language: course.language,
    tags: course.tags,
    hasCertificate: course.hasCertificate,
    estimatedHours: course.estimatedHours,
    objectives: course.objectives,
    skills: course.skills,
    audience: course.audience,
    prerequisites: course.prerequisites,
    price: course.price,
    courseKind: course.courseKind,
    credentialType: course.credentialType,
    cursusLevel: course.cursusLevel,
    cursusMonth: course.cursusMonth,
    mentionId: course.mentionId,
    totalHours: course.totalHours,
    relatedCourseIds: course.relatedCourseIds,
    protectedContent,
    videosReserved,
    canDownloadSupports: onlineCursusStudent,
    cursus: cursus.applies
      ? { inCursus: Boolean(cursus.inCursus), accessible: cursus.accessible, reason: cursus.reason ?? null, month: cursus.month ?? null, level: cursus.level ?? null, studyMode: cursus.studyMode ?? null }
      : null,
    isFeatured: course.isFeatured,
    category: course.category,
    teacher: course.teacher,
    enrollmentsCount: course._count.enrollments,
    ratingAvg: rating.avg,
    ratingCount: rating.count,
    ratingDistribution: rating.distribution,
    myReview,
    isOwner,
    // Suivi de la validation (enseignant / valideur uniquement)
    ...(isOwner && { statusHistory: course.statusHistory, reviewNote: course.reviewNote }),
    enrolled: !isOwner && accessible,
    subscribed,
    progress: enrollment?.progress ?? 0,
    completedAt: enrollment?.completedAt ?? null,
    lastVisitedLessonId: enrollment?.lastVisitedLessonId ?? null,
    certificate: enrollment?.certificate ?? null,
    modules,
    quizzes: course.quizzes
      .filter((q) => isOwner || quizAudiences(cursusMode, course.quizzes.map((x) => x.audience ?? 'ALL')).includes(q.audience ?? 'ALL'))
      .map((q) => ({
      id: q.id,
      audience: q.audience ?? 'ALL',
      title: q.title,
      description: q.description,
      passingScore: q.passingScore,
      timeLimit: q.timeLimit,
      questionCount: q._count.questions,
    })),
  };
}

export async function getCourseBySlug(slug, user) {
  const course = await prisma.onlineCourse.findUnique({ where: { slug }, select: { id: true } });
  if (!course) throw new HttpError(404, 'Course not found');
  return getCourseDetail(course.id, user);
}

export async function updateCourse(courseId, teacherId, patch) {
  const current = await getCourseOwned(courseId, teacherId);
  // eslint-disable-next-line no-unused-vars
  const { status, publishedAt, price, ...rest } = patch; // le prix est géré par le Super Admin
  const data = { ...rest, ...(await normalizeCursusFields(patch, current)) };
  if (status === 'PUBLISHED' && current.status !== 'PUBLISHED' && !(await canReviewCourse(teacherId, current))) {
    throw new HttpError(403, 'Soumettez votre cours à validation : il sera publié par le Responsable de la mention ou le Super Admin.');
  }
  if (status) {
    data.status = status;
    if (status === 'PUBLISHED' && !publishedAt) {
      data.publishedAt = current.publishedAt ?? new Date();
    } else if (publishedAt !== undefined) {
      data.publishedAt = publishedAt ? new Date(publishedAt) : null;
    }
  }
  return prisma.onlineCourse.update({ where: { id: courseId }, data, select: courseCard });
}

export async function deleteCourse(courseId, teacherId) {
  await getCourseOwned(courseId, teacherId);
  await prisma.onlineCourse.delete({ where: { id: courseId } });
}

export async function publishCourse(courseId, teacherId) {
  const course = await getCourseOwned(courseId, teacherId);
  // La publication suit la validation (Super Admin / Responsable de la mention).
  if (course.status !== 'PUBLISHED' && !(await canReviewCourse(teacherId, course))) {
    throw new HttpError(403, 'Soumettez votre cours à validation : il sera publié par le Responsable de la mention ou le Super Admin.');
  }
  if (course.status === 'PUBLISHED') {
    return prisma.onlineCourse.findUnique({ where: { id: courseId }, select: courseCard });
  }
  const lessonCount = await prisma.onlineLesson.count({ where: { module: { courseId } } });
  if (lessonCount === 0) throw new HttpError(422, 'Add at least one lesson before publishing');

  const updated = await prisma.onlineCourse.update({
    where: { id: courseId },
    data: { status: 'PUBLISHED', publishedAt: course.publishedAt ?? new Date() },
    select: courseCard,
  });
  // "Course published" — live broadcast to the online lobby (Phase 5 wires delivery).
  broadcast('course:published', { id: updated.id, title: updated.title, slug: updated.slug });
  return updated;
}

export async function getCourseEnrollments(courseId, teacherId) {
  await getCourseOwned(courseId, teacherId);
  const [items, total] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId },
      select: { id: true, studentId: true, progress: true, completedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.enrollment.count({ where: { courseId } }),
  ]);
  return { items, total };
}

export async function archiveCourse(courseId, teacherId) {
  await getCourseOwned(courseId, teacherId);
  return prisma.onlineCourse.update({
    where: { id: courseId },
    data: { status: 'ARCHIVED' },
    select: courseCard,
  });
}

// Teacher analytics: enrollment funnel, average progress, per-quiz pass rates.
export async function courseAnalytics(courseId, teacherId) {
  await getCourseOwned(courseId, teacherId);
  const [enrollments, lessons, quizzes] = await Promise.all([
    prisma.enrollment.findMany({ where: { courseId }, select: { progress: true, completedAt: true } }),
    prisma.onlineLesson.count({ where: { module: { courseId } } }),
    prisma.quiz.findMany({
      where: { courseId },
      select: { id: true, title: true, onlineAttempts: { select: { passed: true, score: true, maxScore: true } } },
    }),
  ]);

  const total = enrollments.length;
  const completed = enrollments.filter((e) => e.completedAt).length;
  const avgProgress = total ? enrollments.reduce((s, e) => s + e.progress, 0) / total : 0;

  const quizStats = quizzes.map((quiz) => {
    const attempts = quiz.onlineAttempts;
    const n = attempts.length;
    const passRate = n ? (attempts.filter((a) => a.passed).length / n) * 100 : 0;
    const avgScore = n
      ? attempts.reduce((s, a) => s + (a.maxScore ? (a.score / a.maxScore) * 100 : 0), 0) / n
      : 0;
    return { quizId: quiz.id, title: quiz.title, attempts: n, passRate: round2(passRate), avgScore: round2(avgScore) };
  });

  return {
    enrollments: total,
    completed,
    completionRate: round2(total ? (completed / total) * 100 : 0),
    avgProgress: round2(avgProgress),
    lessons,
    quizzes: quizStats,
  };
}


// ─── Personalized recommendations ────────────────────────────────────────────
// Content-based: courses sharing a category or tags with the student's
// enrollments, ranked by affinity + rating + popularity. Falls back to the
// most popular courses when there is no signal yet.
export async function recommendations(studentId, limit = 8) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    select: { courseId: true, course: { select: { categoryId: true, tags: true } } },
  });
  const enrolledIds = enrollments.map((e) => e.courseId);
  const catIds = [...new Set(enrollments.map((e) => e.course.categoryId).filter(Boolean))];
  const tags = [...new Set(enrollments.flatMap((e) => e.course.tags ?? []))];

  const affinity = catIds.length || tags.length
    ? {
        OR: [
          ...(catIds.length ? [{ categoryId: { in: catIds } }] : []),
          ...(tags.length ? [{ tags: { hasSome: tags } }] : []),
        ],
      }
    : {};

  let rows = await prisma.onlineCourse.findMany({
    where: { status: 'PUBLISHED', id: { notIn: enrolledIds }, ...affinity },
    select: courseCard,
    take: 50,
  });
  if (rows.length === 0) {
    rows = await prisma.onlineCourse.findMany({
      where: { status: 'PUBLISHED', id: { notIn: enrolledIds } },
      select: courseCard,
      orderBy: { enrollments: { _count: 'desc' } },
      take: limit,
    });
  }

  const rated = await withRatings(rows);
  const catSet = new Set(catIds);
  const tagSet = new Set(tags);
  return rated
    .map((c) => ({
      ...c,
      _score:
        (c.category && catSet.has(c.category.id) ? 2 : 0)
        + (c.tags ?? []).filter((t) => tagSet.has(t)).length
        + (c.ratingAvg ?? 0) / 2
        + Math.min((c._count?.enrollments ?? 0) / 10, 2),
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...c }) => c);
}


// ─── Featured instructors (landing page strip) ───────────────────────────────
export async function featuredInstructors(limit = 4) {
  const teachers = await prisma.user.findMany({
    where: { isActive: true, onlineCourses: { some: { status: 'PUBLISHED' } } },
    select: {
      id: true, firstName: true, lastName: true, avatarUrl: true,
      onlineCourses: {
        where: { status: 'PUBLISHED' },
        select: { id: true, _count: { select: { enrollments: true } } },
      },
    },
    take: 20,
  });
  const enriched = await Promise.all(
    teachers.map(async (t) => {
      const courseIds = t.onlineCourses.map((c) => c.id);
      const ratings = await ratingsForCourses(courseIds);
      let sum = 0, count = 0;
      for (const r of Object.values(ratings)) { sum += r.avg * r.count; count += r.count; }
      return {
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
        avatarUrl: t.avatarUrl,
        courses: courseIds.length,
        students: t.onlineCourses.reduce((s, c) => s + c._count.enrollments, 0),
        ratingAvg: count ? Math.round((sum / count) * 10) / 10 : 0,
        ratingCount: count,
      };
    })
  );
  return enriched
    .sort((a, b) => (b.students - a.students) || (b.ratingAvg - a.ratingAvg))
    .slice(0, limit);
}

// ─── Public instructor profile ───────────────────────────────────────────────
export async function instructorProfile(teacherId) {
  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, systemRole: { in: ['TEACHER_ONLINE', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true, createdAt: true },
  });
  if (!teacher) throw new HttpError(404, 'Instructeur introuvable');

  const rows = await prisma.onlineCourse.findMany({
    where: { teacherId, status: 'PUBLISHED' },
    select: courseCard,
    orderBy: { publishedAt: 'desc' },
  });
  const courses = await withRatings(rows);

  const students = courses.reduce((s, c) => s + (c._count?.enrollments ?? 0), 0);
  const ratedCourses = courses.filter((c) => c.ratingCount > 0);
  const totalReviews = ratedCourses.reduce((s, c) => s + c.ratingCount, 0);
  const avgRating = totalReviews
    ? round2(ratedCourses.reduce((s, c) => s + c.ratingAvg * c.ratingCount, 0) / totalReviews)
    : 0;

  return {
    teacher,
    stats: { courses: courses.length, students, avgRating, reviews: totalReviews },
    courses,
  };
}
