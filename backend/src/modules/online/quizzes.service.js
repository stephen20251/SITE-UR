import { prisma } from '../../database/prisma.js';
import { isOnlineTeacher } from '../../middlewares/auth.js';
import { isCursusEnrollment, quizAudiences } from '../cursus/cursus.access.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { notifyUser, notifyUsers } from '../../utils/notify.js';
import { getCourseOwned, getQuizOwned, getEnrollmentOrThrow } from './online.guards.js';
import { logActivity, tryIssueCertificate, courseCompletion } from './enrollment.service.js';

const round2 = (n) => Math.round(n * 100) / 100;

// ─── Teacher: author a quiz ───
// Règle du Super Admin « quiz et devoirs après les leçons »
export async function assertActivitiesOpen(studentId, courseId) {
  if (!courseId) return;
  const c = await courseCompletion(studentId, courseId);
  if (c?.activitiesLocked) {
    throw new HttpError(403, `Terminez d'abord les leçons du cours (${Math.round(c.lessonsProgress)} % / ${c.lessonThreshold} %) : le quiz s'ouvrira ensuite.`);
  }
}

export async function createQuiz(courseId, teacherId, input) {
  await getCourseOwned(courseId, teacherId);

  const quiz = await prisma.quiz.create({
    data: {
      courseId,
      title: input.title,
      description: input.description,
      passingScore: input.passingScore,
      timeLimit: input.timeLimit,
      randomize: input.randomize ?? false,
      poolSize: input.poolSize ?? null,
      audience: input.audience ?? 'ALL',
      questions: {
        create: input.questions.map((q, i) => ({
          text: q.text,
          type: q.type,
          points: q.points,
          order: q.order ?? i,
          options: { create: q.options.map((o, j) => ({ text: o.text, isCorrect: o.isCorrect, order: j })) },
        })),
      },
    },
    include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } },
  });

  const enrolled = await prisma.enrollment.findMany({ where: { courseId }, select: { studentId: true } });
  notifyUsers(
    enrolled.map((e) => e.studentId),
    { type: 'ANNOUNCEMENT', title: 'Nouveau quiz disponible', body: input.title, link: `/online/course/${courseId}`, data: { courseId, quizId: quiz.id } },
  ).catch(() => {});

  return quiz;
}

export async function updateQuiz(quizId, teacherId, patch) {
  await getQuizOwned(quizId, teacherId);
  const { title, description, passingScore, timeLimit, randomize, poolSize, audience } = patch;
  return prisma.quiz.update({
    where: { id: quizId },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(passingScore !== undefined && { passingScore }),
      ...(timeLimit !== undefined && { timeLimit }),
      ...(randomize !== undefined && { randomize }),
      ...(poolSize !== undefined && { poolSize }),
      ...(audience !== undefined && { audience }),
    },
  });
}

// ─── Modification d'un QCM existant, question par question ───────────────────
// Les résultats déjà enregistrés sont conservés : chaque tentative garde ses réponses
// et sa note (elles ne dépendent pas des questions). Les options existantes sont
// mises à jour sur place (même identifiant), les nouvelles ajoutées.
async function questionOwned(questionId, userId) {
  const q = await prisma.quizQuestion.findUnique({ where: { id: questionId }, include: { options: true } });
  if (!q) throw new HttpError(404, 'Question introuvable');
  await getQuizOwned(q.quizId, userId);
  return q;
}

async function writeOptions(questionId, options, existing = []) {
  const keep = new Set(options.filter((o) => o.id).map((o) => o.id));
  const known = new Set(existing.map((o) => o.id));
  // Options retirées
  const removed = existing.filter((o) => !keep.has(o.id)).map((o) => o.id);
  if (removed.length) await prisma.quizOption.deleteMany({ where: { id: { in: removed } } });
  for (const [i, o] of options.entries()) {
    if (o.id && known.has(o.id)) {
      await prisma.quizOption.update({ where: { id: o.id }, data: { text: o.text, isCorrect: o.isCorrect, order: i } });
    } else {
      await prisma.quizOption.create({ data: { questionId, text: o.text, isCorrect: o.isCorrect, order: i } });
    }
  }
}

export async function addQuestion(quizId, userId, input) {
  await getQuizOwned(quizId, userId);
  const last = await prisma.quizQuestion.findFirst({ where: { quizId }, orderBy: { order: 'desc' }, select: { order: true } });
  const q = await prisma.quizQuestion.create({
    data: {
      quizId, text: input.text, type: input.type, points: input.points ?? 1,
      explanation: input.explanation ?? null, order: input.order ?? (last?.order ?? -1) + 1,
    },
  });
  await writeOptions(q.id, input.options);
  return prisma.quizQuestion.findUnique({ where: { id: q.id }, include: { options: { orderBy: { order: 'asc' } } } });
}

export async function updateQuestion(questionId, userId, input) {
  const current = await questionOwned(questionId, userId);
  await prisma.quizQuestion.update({
    where: { id: questionId },
    data: {
      text: input.text, type: input.type, points: input.points ?? current.points,
      ...(input.explanation !== undefined && { explanation: input.explanation }),
      ...(input.order !== undefined && { order: input.order }),
    },
  });
  await writeOptions(questionId, input.options, current.options);
  return prisma.quizQuestion.findUnique({ where: { id: questionId }, include: { options: { orderBy: { order: 'asc' } } } });
}

export async function deleteQuestion(questionId, userId) {
  const q = await questionOwned(questionId, userId);
  const count = await prisma.quizQuestion.count({ where: { quizId: q.quizId } });
  if (count <= 1) throw new HttpError(400, 'Un QCM doit garder au moins une question');
  await prisma.quizQuestion.delete({ where: { id: questionId } });
  return { ok: true };
}

// Super Admin : tous les QCM de la plateforme, avec cours, enseignant et résultats.
export async function listAllQuizzes({ q } = {}) {
  const s = String(q ?? '').trim();
  const quizzes = await prisma.quiz.findMany({
    where: {
      courseId: { not: null },
      ...(s && { OR: [{ title: { contains: s } }, { onlineCourse: { title: { contains: s } } }] }),
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, title: true, passingScore: true, timeLimit: true, audience: true, updatedAt: true, createdAt: true,
      onlineCourse: { select: { id: true, title: true, courseKind: true, teacher: { select: { firstName: true, lastName: true } } } },
      _count: { select: { questions: true, onlineAttempts: true } },
    },
    take: 300,
  });
  return quizzes.map((x) => ({
    id: x.id, title: x.title, passingScore: x.passingScore, timeLimit: x.timeLimit, audience: x.audience,
    updatedAt: x.updatedAt, createdAt: x.createdAt,
    course: x.onlineCourse, questionCount: x._count.questions, attemptCount: x._count.onlineAttempts,
  }));
}

export async function deleteQuiz(quizId, teacherId) {
  await getQuizOwned(quizId, teacherId);
  await prisma.quiz.delete({ where: { id: quizId } });
}

// ─── List a course's quizzes ───
export async function listForCourse(courseId, user) {
  const course = await prisma.onlineCourse.findUnique({
    where: { id: courseId },
    select: { id: true, teacherId: true, courseKind: true, cursusLevel: true, mentionId: true },
  });
  if (!course) throw new HttpError(404, 'Course not found');

  const isOwner = (isOnlineTeacher(user) && course.teacherId === user.sub)
    || user.role === 'SUPER_ADMIN' || user.systemRole === 'SUPER_ADMIN';
  if (!isOwner) await getEnrollmentOrThrow(user.sub, courseId);
  // Chaque public a son propre espace test (étudiants du cursus / non-étudiants).
  const existing = (await prisma.quiz.findMany({ where: { courseId }, select: { audience: true } })).map((q) => q.audience);
  const audiences = isOwner ? undefined : quizAudiences(await isCursusEnrollment(user.sub, course), existing);

  const quizzes = await prisma.quiz.findMany({
    where: { courseId, ...(audiences && { audience: { in: audiences } }) },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      passingScore: true,
      timeLimit: true,
      audience: true,
      createdAt: true,
      _count: { select: { questions: true } },
    },
  });

  if (!isOwner) {
    // Attach student's best attempt summary per quiz
    const attempts = await prisma.onlineQuizAttempt.findMany({
      where: { studentId: user.sub, quizId: { in: quizzes.map((q) => q.id) } },
      orderBy: { submittedAt: 'desc' },
    });
    const latest = new Map();
    for (const a of attempts) if (!latest.has(a.quizId)) latest.set(a.quizId, a);
    return quizzes.map((q) => {
      const a = latest.get(q.id);
      return {
        ...q,
        questionCount: q._count.questions,
        attempted: Boolean(a),
        lastScore: a ? round2((a.score / a.maxScore) * 100) : null,
        passed: a?.passed ?? null,
      };
    });
  }

  return quizzes.map((q) => ({ ...q, questionCount: q._count.questions }));
}

// ─── Get all pending quizzes for a student (cross-course) ───
export async function myPendingQuizzes(studentId) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    select: { courseId: true },
  });
  const courseIds = enrollments.map((e) => e.courseId);
  if (!courseIds.length) return [];

  const quizzes = await prisma.quiz.findMany({
    where: { courseId: { in: courseIds } },
    select: {
      id: true, title: true, courseId: true, passingScore: true, timeLimit: true,
      _count: { select: { questions: true } },
      onlineCourse: { select: { id: true, title: true, slug: true } },
    },
  });

  const attempts = await prisma.onlineQuizAttempt.findMany({
    where: { studentId, quizId: { in: quizzes.map((q) => q.id) } },
    select: { quizId: true, passed: true },
  });
  const passedSet = new Set(attempts.filter((a) => a.passed).map((a) => a.quizId));
  const attemptedSet = new Set(attempts.map((a) => a.quizId));

  return quizzes
    .filter((q) => !passedSet.has(q.id))
    .map((q) => ({
      id: q.id,
      title: q.title,
      courseId: q.courseId,
      course: q.onlineCourse,
      questionCount: q._count.questions,
      passingScore: q.passingScore,
      timeLimit: q.timeLimit,
      attempted: attemptedSet.has(q.id),
    }));
}

// ─── Get one quiz ───
// ─── Question-bank randomization ───
// Deterministic per-(student, quiz, attempt#) shuffle: the exact same subset is
// recomputed at grading time, so the served questions can't be cherry-picked.
function seededShuffle(arr, seedStr) {
  let h = 2166136261 >>> 0;
  for (const c of seedStr) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rand = () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function servedQuestions(quiz, studentId, attemptCount) {
  if (!quiz.randomize) return quiz.questions;
  const seed = `${studentId}:${quiz.id}:${attemptCount}`;
  const shuffled = seededShuffle(quiz.questions, seed);
  const n = quiz.poolSize && quiz.poolSize > 0 ? Math.min(quiz.poolSize, shuffled.length) : shuffled.length;
  return shuffled.slice(0, n).map((q) => ({ ...q, options: seededShuffle(q.options, `${seed}:${q.id}`) }));
}

export async function getQuiz(quizId, user) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      onlineCourse: { select: { teacherId: true } },
      questions: { orderBy: { order: 'asc' }, include: { options: true } },
    },
  });
  if (!quiz) throw new HttpError(404, 'Quiz not found');

  const isOwner = (isOnlineTeacher(user) && quiz.onlineCourse?.teacherId === user.sub)
    || user.role === 'SUPER_ADMIN' || user.systemRole === 'SUPER_ADMIN';
  if (!isOwner) await getEnrollmentOrThrow(user.sub, quiz.courseId);
  if (!isOwner) await assertActivitiesOpen(user.sub, quiz.courseId);

  await logActivity(user.sub, quiz.courseId, null, quizId, 'quiz_start');

  // Students taking a randomized quiz get a per-attempt subset of the bank.
  let questions = quiz.questions;
  if (!isOwner && quiz.randomize) {
    const attemptCount = await prisma.onlineQuizAttempt.count({ where: { quizId, studentId: user.sub } });
    questions = servedQuestions(quiz, user.sub, attemptCount);
  }

  return {
    id: quiz.id,
    courseId: quiz.courseId,
    title: quiz.title,
    description: quiz.description,
    passingScore: quiz.passingScore,
    timeLimit: quiz.timeLimit,
    randomize: quiz.randomize,
    poolSize: quiz.poolSize,
    audience: quiz.audience,
    bankSize: quiz.questions.length,
    questions: questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      points: q.points,
      order: q.order,
      ...(isOwner && { explanation: q.explanation ?? null }),
      options: [...q.options].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((o) => ({
        id: o.id,
        text: o.text,
        ...(isOwner && { isCorrect: o.isCorrect }),
      })),
    })),
  };
}

// ─── Student: submit answers → auto-grade ───
export async function submitQuiz(quizId, studentId, answers) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { questions: { include: { options: true } } },
  });
  if (!quiz) throw new HttpError(404, 'Quiz not found');
  await getEnrollmentOrThrow(studentId, quiz.courseId);
  await assertActivitiesOpen(studentId, quiz.courseId);

  const selectedByQuestion = new Map(answers.map((a) => [a.questionId, new Set(a.selectedOptionIds)]));

  // Recompute the served subset for this attempt (same seed as getQuiz).
  let gradedQuestions = quiz.questions;
  if (quiz.randomize) {
    const attemptCount = await prisma.onlineQuizAttempt.count({ where: { quizId, studentId } });
    gradedQuestions = servedQuestions(quiz, studentId, attemptCount);
  }

  let score = 0;
  let maxScore = 0;
  const breakdown = [];

  for (const q of gradedQuestions) {
    maxScore += q.points;
    const validIds = new Set(q.options.map((o) => o.id));
    const correctIds = new Set(q.options.filter((o) => o.isCorrect).map((o) => o.id));
    const selected = new Set([...(selectedByQuestion.get(q.id) ?? [])].filter((id) => validIds.has(id)));

    const isCorrect =
      correctIds.size > 0 &&
      selected.size === correctIds.size &&
      [...selected].every((id) => correctIds.has(id));

    const awarded = isCorrect ? q.points : 0;
    score += awarded;
    breakdown.push({
      questionId: q.id,
      correct: isCorrect,
      awarded,
      points: q.points,
      selectedOptionIds: [...selected],
      correctOptionIds: [...correctIds],
    });
  }

  const percentage = maxScore ? round2((score / maxScore) * 100) : 0;
  const passed = percentage >= quiz.passingScore;

  const attempt = await prisma.onlineQuizAttempt.create({
    data: { quizId, studentId, score, maxScore, passed, answers },
  });

  await logActivity(studentId, quiz.courseId, null, quizId, 'quiz_complete', { passed, score, maxScore });

  // If student passed, check whether all cert conditions are now met
  let certificate = null;
  if (passed && quiz.courseId) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId: quiz.courseId } },
      select: { id: true },
    });
    if (enrollment) {
      certificate = await tryIssueCertificate(studentId, enrollment.id, quiz.courseId).catch(() => null);
    }
  }

  notifyUser(studentId, {
    type: 'SUCCESS',
    title: 'Résultat du quiz',
    body: `${quiz.title} : ${percentage} %`,
    link: `/online/course/${quiz.courseId}`,
    data: { quizId, attemptId: attempt.id, passed },
  }).catch(() => {});

  return {
    attemptId: attempt.id,
    score,
    maxScore,
    percentage,
    passed,
    passingScore: quiz.passingScore,
    breakdown,
    certificate,
  };
}

export async function myAttempts(quizId, studentId) {
  await prisma.quiz.findUniqueOrThrow({ where: { id: quizId }, select: { id: true } });
  return prisma.onlineQuizAttempt.findMany({
    where: { quizId, studentId },
    orderBy: { submittedAt: 'desc' },
    select: { id: true, score: true, maxScore: true, passed: true, submittedAt: true },
  });
}

// ─── Teacher: every attempt on a quiz (analytics) ───
export async function quizAttempts(quizId, teacherId) {
  await getQuizOwned(quizId, teacherId);
  const attempts = await prisma.onlineQuizAttempt.findMany({
    where: { quizId },
    orderBy: { submittedAt: 'desc' },
  });
  const n = attempts.length;
  const passRate = n ? round2((attempts.filter((a) => a.passed).length / n) * 100) : 0;
  const avgScore = n
    ? round2(attempts.reduce((s, a) => s + (a.maxScore ? (a.score / a.maxScore) * 100 : 0), 0) / n)
    : 0;

  return {
    total: n,
    passRate,
    avgScore,
    attempts: attempts.map((a) => ({
      id: a.id,
      studentId: a.studentId,
      score: a.score,
      maxScore: a.maxScore,
      percentage: a.maxScore ? round2((a.score / a.maxScore) * 100) : 0,
      passed: a.passed,
      submittedAt: a.submittedAt,
    })),
  };
}
