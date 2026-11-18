import crypto from 'crypto';
import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { notifyUser } from '../../utils/notify.js';
import { sendEmail, renderEmail } from '../../utils/mailer.js';
import { getEnrollmentOrThrow } from './online.guards.js';
import { cursusAccess, isCursusEnrollment, isReservedVideoLesson, quizAudiences } from '../cursus/cursus.access.js';
import { getProgressRules } from './progress-rules.js';

const CURSUS_LOCK_MSG = {
  tuition_unpaid: "Ce cours est débloqué par le paiement de l'écolage du mois correspondant.",
  related_incomplete: "Terminez d'abord les cours liés à celui-ci.",
  not_student: "Le cursus universitaire est réservé aux étudiants de l'UR : déposez votre candidature pour y accéder.",
  not_in_cursus: "Ce cours appartient à un autre niveau ou une autre mention que votre cursus.",
};

const round2 = (n) => Math.round(n * 100) / 100;

// ─── Enroll ───
export async function enroll(studentId, courseId, user) {
  const course = await prisma.onlineCourse.findUnique({
    where: { id: courseId },
    select: {
      id: true, status: true, title: true, teacherId: true,
      courseKind: true, cursusLevel: true, cursusMonth: true, mentionId: true, relatedCourseIds: true,
      price: true,
    },
  });
  if (!course) throw new HttpError(404, 'Course not found');
  if (course.status !== 'PUBLISHED') throw new HttpError(422, 'Course is not open for enrollment');
  const cursus = await cursusAccess(user ?? { sub: studentId }, course);
  if (cursus.applies && !cursus.accessible) throw new HttpError(403, CURSUS_LOCK_MSG[cursus.reason] ?? 'Accès refusé');
  if (!cursus.applies && (course.price ?? 0) > 0) {
    throw new HttpError(402, 'Ce cours est payant : passez par le paiement pour vous inscrire.');
  }

  const existing = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
  });
  if (existing) {
    // A deliberate (free) enrollment promotes a subscription-only one to permanent.
    if (existing.viaSubscription) {
      return prisma.enrollment.update({ where: { id: existing.id }, data: { viaSubscription: false } });
    }
    return existing;
  }

  const enrollment = await prisma.enrollment.create({ data: { studentId, courseId } });

  notifyUser(course.teacherId, {
    type: 'INFO',
    title: 'Nouvelle inscription',
    body: `Un étudiant s'est inscrit au cours « ${course.title} »`,
    link: `/online/studio/${courseId}`,
    data: { courseId },
  }).catch(() => {});

  await logActivity(studentId, courseId, null, null, 'enrollment');
  return enrollment;
}

export async function myEnrollments(studentId, { page, limit }) {
  const where = { studentId };
  const [items, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { lastVisitedAt: { sort: 'desc', nulls: 'last' } },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnail: true,
            teacher: { select: { firstName: true, lastName: true } },
          },
        },
        certificate: { select: { id: true, code: true, issuedAt: true } },
      },
    }),
    prisma.enrollment.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function myEnrollmentDetail(studentId, courseId) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
    include: {
      lessonProgress: { select: { lessonId: true, completed: true, watchedSec: true, updatedAt: true } },
      course: { select: { id: true, title: true, slug: true } },
      certificate: { select: { id: true, code: true, issuedAt: true } },
    },
  });
  if (!enrollment) throw new HttpError(404, 'You are not enrolled in this course');
  return enrollment;
}

// ─── Progress ───
export async function updateLessonProgress(studentId, lessonId, patch) {
  const lesson = await prisma.onlineLesson.findUnique({
    where: { id: lessonId },
    select: { id: true, module: { select: { id: true, courseId: true } } },
  });
  if (!lesson) throw new HttpError(404, 'Lesson not found');

  const courseId = lesson.module.courseId;
  const enrollment = await getEnrollmentOrThrow(studentId, courseId);

  const lessonProgress = await prisma.onlineLessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
    create: {
      enrollmentId: enrollment.id,
      lessonId,
      completed: patch.completed ?? false,
      watchedSec: patch.watchedSec ?? 0,
      ...(patch.completed && { completedAt: new Date() }),
    },
    update: {
      ...(patch.completed !== undefined && {
        completed: patch.completed,
        ...(patch.completed && { completedAt: new Date() }),
      }),
      ...(patch.watchedSec !== undefined && { watchedSec: patch.watchedSec }),
    },
  });

  // Track last visited
  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      lastVisitedLessonId: lessonId,
      lastVisitedAt: new Date(),
      lastOpenedModuleId: lesson.module.id,
    },
  });

  // Log activity
  const action = patch.completed ? 'lesson_complete' : 'lesson_open';
  await logActivity(studentId, courseId, lessonId, null, action);

  const summary = await recomputeProgress(enrollment, courseId);
  return { lesson: lessonProgress, ...summary };
}

async function recomputeProgress(enrollment, courseId) {
  const course = await prisma.onlineCourse.findUnique({
    where: { id: courseId },
    select: { id: true, courseKind: true, cursusLevel: true, mentionId: true },
  });
  // Seuil des leçons (Super Admin) : cursus universitaire 100 %, cours certifiant 80 % par défaut.
  const inCursus = await isCursusEnrollment(enrollment.studentId, course);
  const rules = await getProgressRules();
  const threshold = inCursus ? rules.cursusLessonThreshold : rules.certifyingLessonThreshold;
  // Présentiel : les vidéos qui lui sont fermées ne comptent pas dans l'avancement.
  const presentiel = inCursus && (await prisma.studentProfile.findUnique({
    where: { userId: enrollment.studentId }, select: { studyMode: true },
  }))?.studyMode === 'PRESENTIEL';
  const lessons = await prisma.onlineLesson.findMany({
    where: { module: { courseId } },
    select: { id: true, type: true, contentUrl: true, isPreview: true },
  });
  const countedIds = lessons.filter((l) => !(presentiel && isReservedVideoLesson(l))).map((l) => l.id);
  const totalLessons = countedIds.length;
  const completedLessons = await prisma.onlineLessonProgress.count({
    where: { enrollmentId: enrollment.id, completed: true, lessonId: { in: countedIds } },
  });

  const progress = totalLessons ? round2((completedLessons / totalLessons) * 100) : 0;
  const lessonsDone = progress >= threshold && !enrollment.completedAt;

  const updated = await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: { progress },
  });

  let certificate = null;
  let completedAt = updated.completedAt;
  if (lessonsDone) {
    certificate = await tryIssueCertificate(enrollment.studentId, enrollment.id, courseId);
    const after = await prisma.enrollment.findUnique({ where: { id: enrollment.id }, select: { completedAt: true } });
    completedAt = after?.completedAt ?? null;
  }

  return {
    progress: updated.progress,
    completed: Boolean(completedAt),
    completedLessons,
    totalLessons,
    certificate,
  };
}

// Check all 3 conditions and issue cert if met. Safe to call multiple times (upsert).
export async function tryIssueCertificate(studentId, enrollmentId, courseId) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { completedAt: true, progress: true },
  });
  if (!enrollment || enrollment.completedAt) return null; // already issued

  const course = await prisma.onlineCourse.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, courseKind: true, cursusLevel: true, cursusMonth: true, mentionId: true },
  });
  const cursus = await isCursusEnrollment(studentId, course);
  const rules = await getProgressRules();
  if (enrollment.progress < (cursus ? rules.cursusLessonThreshold : rules.certifyingLessonThreshold)) return null; // leçons pas terminées

  // Quiz et devoirs exigés (règles du Super Admin)
  const activities = await courseActivities(studentId, course, cursus);
  if (rules.requireQuizzes && activities.quizzes.some((q) => !q.passed)) return null;
  if (rules.requireAssignments && activities.assignments.some((a) => !a.submitted)) return null;

  // All conditions met — mark completed
  await prisma.enrollment.update({ where: { id: enrollmentId }, data: { completedAt: new Date() } });

  // Cursus universitaire : pas de certificat (le diplôme sanctionne l'année) ;
  // le cours terminé compte pour débloquer le paiement du mois suivant.
  if (cursus) {
    await logActivity(studentId, courseId, null, null, 'cursus_course_completed');
    notifyUser(studentId, {
      type: 'SUCCESS',
      title: 'Cours terminé ✅',
      body: `Vous avez terminé « ${course.title} » (mois ${course.cursusMonth}).`,
      link: '/classroom/cursus',
    }).catch(() => {});
    return null;
  }
  return issueCertificate(studentId, enrollmentId, courseId);
}

// Quiz (de l'espace test de l'étudiant) et devoirs ouverts d'un cours, avec leur état.
export async function courseActivities(studentId, course, cursus) {
  const all = await prisma.quiz.findMany({ where: { courseId: course.id }, select: { id: true, title: true, audience: true, passingScore: true, createdAt: true }, orderBy: { createdAt: 'asc' } });
  const audiences = quizAudiences(cursus, all.map((q) => q.audience));
  const quizzes = all.filter((q) => audiences.includes(q.audience ?? 'ALL'));
  const attempts = quizzes.length
    ? await prisma.onlineQuizAttempt.findMany({ where: { studentId, quizId: { in: quizzes.map((q) => q.id) } }, select: { quizId: true, passed: true, score: true, maxScore: true } })
    : [];
  const assignments = await prisma.onlineAssignment.findMany({ where: { courseId: course.id, status: 'OPEN' }, select: { id: true, title: true, dueDate: true }, orderBy: { dueDate: 'asc' } });
  const subs = assignments.length
    ? await prisma.onlineSubmission.findMany({ where: { studentId, assignmentId: { in: assignments.map((a) => a.id) } }, select: { assignmentId: true, status: true } })
    : [];
  return {
    quizzes: quizzes.map((q) => {
      const mine = attempts.filter((a) => a.quizId === q.id);
      const best = mine.reduce((b, a) => Math.max(b, a.maxScore ? (a.score / a.maxScore) * 100 : 0), 0);
      return { id: q.id, title: q.title, passingScore: q.passingScore, attempted: mine.length > 0, passed: mine.some((a) => a.passed), bestScore: mine.length ? round2(best) : null };
    }),
    assignments: assignments.map((a) => {
      const s = subs.find((x) => x.assignmentId === a.id);
      return { id: a.id, title: a.title, dueDate: a.dueDate, submitted: Boolean(s), graded: s?.status === 'GRADED' };
    }),
  };
}

// État d'un cours pour un étudiant : leçons, quiz, devoirs, statut et prochaine activité.
// Remet aussi le cours « terminé » quand toutes les conditions sont réunies (règles changées,
// quiz retiré…), pour que l'affichage reste cohérent.
export async function courseCompletion(studentId, courseId) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
    select: { id: true, progress: true, completedAt: true },
  });
  const course = await prisma.onlineCourse.findUnique({
    where: { id: courseId },
    select: { id: true, courseKind: true, cursusLevel: true, cursusMonth: true, mentionId: true },
  });
  if (!course) return null;
  const rules = await getProgressRules();
  const cursus = await isCursusEnrollment(studentId, course);
  const threshold = cursus ? rules.cursusLessonThreshold : rules.certifyingLessonThreshold;
  const progress = enrollment?.progress ?? 0;
  const lessonsDone = progress >= threshold;
  const activities = await courseActivities(studentId, course, cursus);
  let completedAt = enrollment?.completedAt ?? null;
  if (enrollment && !completedAt && lessonsDone) {
    await tryIssueCertificate(studentId, enrollment.id, courseId).catch(() => null);
    completedAt = (await prisma.enrollment.findUnique({ where: { id: enrollment.id }, select: { completedAt: true } }))?.completedAt ?? null;
  }
  const pendingQuiz = activities.quizzes.find((q) => !q.passed);
  const pendingAssignment = activities.assignments.find((a) => !a.submitted);
  const nextActivity = completedAt ? null
    : !lessonsDone ? null
    : pendingQuiz ? { type: 'QUIZ', id: pendingQuiz.id, title: pendingQuiz.title }
    : pendingAssignment ? { type: 'ASSIGNMENT', id: pendingAssignment.id, title: pendingAssignment.title }
    : null;
  const status = completedAt ? 'COMPLETED'
    : !enrollment || progress === 0 ? 'NOT_STARTED'
    : !lessonsDone ? 'IN_PROGRESS'
    : pendingQuiz && rules.requireQuizzes ? 'QUIZ_PENDING'
    : pendingAssignment && rules.requireAssignments ? 'ASSIGNMENT_PENDING'
    : 'IN_PROGRESS';
  return {
    status,
    completed: Boolean(completedAt),
    completedAt,
    progress: completedAt ? Math.max(progress, threshold) : progress,
    lessonsProgress: progress,
    lessonThreshold: threshold,
    lessonsDone,
    quizzes: activities.quizzes,
    assignments: activities.assignments,
    nextActivity,
    activitiesLocked: rules.activitiesAfterLessons && !lessonsDone && !completedAt,
    rules: { requireQuizzes: rules.requireQuizzes, requireAssignments: rules.requireAssignments, activitiesAfterLessons: rules.activitiesAfterLessons },
  };
}

// Recalcule la progression de toutes les inscriptions (après un changement de règles).
export async function recomputeAllProgress() {
  const enrollments = await prisma.enrollment.findMany({ select: { id: true, studentId: true, courseId: true, completedAt: true } });
  let completed = 0;
  for (const e of enrollments) {
    const before = e.completedAt;
    await recomputeProgress(e, e.courseId).catch(() => null);
    if (!before) {
      const after = await prisma.enrollment.findUnique({ where: { id: e.id }, select: { completedAt: true, progress: true } });
      if (!after?.completedAt) await tryIssueCertificate(e.studentId, e.id, e.courseId).catch(() => null);
      if ((await prisma.enrollment.findUnique({ where: { id: e.id }, select: { completedAt: true } }))?.completedAt) completed += 1;
    }
  }
  return { enrollments: enrollments.length, newlyCompleted: completed };
}

// ─── Certificates ───
async function issueCertificate(studentId, enrollmentId, courseId) {
  const course = await prisma.onlineCourse.findUnique({
    where: { id: courseId },
    select: { title: true, slug: true, credentialType: true },
  });
  const docLabel = course.credentialType === 'ATTESTATION' ? 'attestation' : 'certificat';

  const cert = await prisma.onlineCertificate.upsert({
    where: { studentId_courseId: { studentId, courseId } },
    create: {
      studentId,
      courseId,
      enrollmentId,
      code: `CERT-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
    },
    update: {},
  });

  await logActivity(studentId, courseId, null, null, 'certificate_earned');

  notifyUser(studentId, {
    type: 'SUCCESS',
    title: docLabel === 'attestation' ? 'Attestation débloquée 🎓' : 'Certificat débloqué 🎓',
    body: `Vous avez terminé « ${course.title} » — votre ${docLabel} est prêt(e) !`,
    link: `/online/certificate/${cert.code}`,
  }).catch(() => {});

  // Congratulations email with a link to the verifiable certificate.
  prisma.user.findUnique({ where: { id: studentId }, select: { email: true, firstName: true } })
    .then((u) => u && sendEmail({
      to: u.email,
      subject: `🎓 Félicitations — votre certificat « ${course.title} » est prêt`,
      html: renderEmail({
        title: 'Votre certificat est prêt ! 🎓',
        greeting: `Bravo ${u.firstName},`,
        body: `Vous avez complété avec succès le cours <b>« ${course.title} »</b>.<br/>Votre certificat officiel — vérifiable en ligne grâce au code <b style="font-family:monospace">${cert.code}</b> — vous attend. Téléchargez-le, imprimez-le ou partagez-le sur LinkedIn.`,
        ctaLabel: 'Voir mon certificat',
        ctaUrl: `/online/certificate/${cert.code}`,
      }),
    }))
    .catch(() => {});

  return cert;
}

export async function myCertificates(studentId) {
  return prisma.onlineCertificate.findMany({
    where: { studentId },
    orderBy: { issuedAt: 'desc' },
    include: { course: { select: { id: true, title: true, slug: true, thumbnail: true } } },
  });
}

export async function verifyCertificate(code) {
  const cert = await prisma.onlineCertificate.findUnique({
    where: { code },
    include: {
      course: { select: { id: true, title: true, slug: true } },
      enrollment: { select: { progress: true } },
    },
  });
  if (!cert) throw new HttpError(404, 'Certificate not found');
  // Enrollment carries only a bare studentId column — resolve the user directly.
  const student = await prisma.user.findUnique({
    where: { id: cert.studentId },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  return {
    id: cert.id,
    code: cert.code,
    issuedAt: cert.issuedAt,
    courseId: cert.courseId,
    courseTitle: cert.course.title,
    studentName: student ? `${student.firstName} ${student.lastName}` : 'Étudiant',
    studentEmail: student?.email ?? '',
    progress: cert.enrollment?.progress ?? 100,
    valid: true,
  };
}

// ─── Activity log ───
async function logActivity(studentId, courseId, lessonId, quizId, action, meta) {
  await prisma.learningActivity.create({
    data: {
      studentId,
      courseId: courseId ?? undefined,
      lessonId: lessonId ?? undefined,
      quizId: quizId ?? undefined,
      action,
      meta: meta ? JSON.parse(JSON.stringify(meta)) : undefined,
    },
  }).catch(() => {}); // non-blocking
}

export { logActivity };
