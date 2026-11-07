import crypto from 'crypto';
import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { notifyUser } from '../../utils/notify.js';
import { sendEmail, renderEmail } from '../../utils/mailer.js';
import { getEnrollmentOrThrow } from './online.guards.js';
import { cursusAccess, isCursusEnrollment, quizAudiences } from '../cursus/cursus.access.js';

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
    title: 'New enrollment',
    body: `A student enrolled in "${course.title}"`,
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
  // Cursus universitaire : il faut 100 % des leçons ; cours certifiant : 80 %.
  const threshold = (await isCursusEnrollment(enrollment.studentId, course)) ? 100 : 80;
  const [totalLessons, completedLessons] = await Promise.all([
    prisma.onlineLesson.count({ where: { module: { courseId } } }),
    prisma.onlineLessonProgress.count({ where: { enrollmentId: enrollment.id, completed: true } }),
  ]);

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
  if (enrollment.progress < (cursus ? 100 : 80)) return null; // lessons not done

  // Every quiz of the student's "test space" (cursus students / others) must be passed
  const courseQuizzes = await prisma.quiz.findMany({
    where: {
      courseId,
      audience: { in: quizAudiences(cursus, (await prisma.quiz.findMany({ where: { courseId }, select: { audience: true } })).map((q) => q.audience)) },
    },
    select: { id: true },
  });
  if (courseQuizzes.length > 0) {
    for (const quiz of courseQuizzes) {
      const passed = await prisma.onlineQuizAttempt.findFirst({
        where: { quizId: quiz.id, studentId, passed: true },
      });
      if (!passed) return null;
    }
  }

  // All open assignments must be submitted
  const openAssignments = await prisma.onlineAssignment.findMany({
    where: { courseId, status: 'OPEN' },
    select: { id: true },
  });
  if (openAssignments.length > 0) {
    for (const a of openAssignments) {
      const sub = await prisma.onlineSubmission.findUnique({
        where: { assignmentId_studentId: { assignmentId: a.id, studentId } },
      });
      if (!sub) return null;
    }
  }

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
