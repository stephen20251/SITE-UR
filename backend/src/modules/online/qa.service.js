import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { notifyUser } from '../../utils/notify.js';
import { broadcast } from '../../realtime/events.js';
import { isSuperAdmin } from './online.guards.js';

const USER_CARD = { id: true, firstName: true, lastName: true, avatarUrl: true };

// ─── Access ───
// Reading/posting in a course forum requires being enrolled, the owning teacher,
// or a super admin. Returns { course, isOwner, isAdmin }.
async function requireCourseAccess(user, courseId) {
  const course = await prisma.onlineCourse.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, teacherId: true },
  });
  if (!course) throw new HttpError(404, 'Course not found');
  const isAdmin = await isSuperAdmin(user.sub);
  const isOwner = course.teacherId === user.sub || isAdmin;
  if (!isOwner) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: user.sub, courseId } },
      select: { id: true },
    });
    if (!enrollment) throw new HttpError(403, 'Vous devez être inscrit pour accéder au forum');
  }
  return { course, isOwner, isAdmin };
}

const questionCard = {
  id: true,
  courseId: true,
  lessonId: true,
  title: true,
  body: true,
  resolved: true,
  upvotes: true,
  createdAt: true,
  author: { select: USER_CARD },
  lesson: { select: { id: true, title: true } },
  _count: { select: { answers: true } },
};

const answerShape = {
  id: true,
  questionId: true,
  body: true,
  isInstructor: true,
  isAccepted: true,
  upvotes: true,
  createdAt: true,
  author: { select: USER_CARD },
};

// ─── Read ───
export async function listQuestions(user, courseId, { lessonId, resolved, page = 1, limit = 20 } = {}) {
  await requireCourseAccess(user, courseId);
  const where = {
    courseId,
    ...(lessonId && { lessonId }),
    ...(resolved === true || resolved === false ? { resolved } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.courseQuestion.findMany({
      where,
      select: questionCard,
      orderBy: [{ resolved: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.courseQuestion.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function getQuestion(user, questionId) {
  const question = await prisma.courseQuestion.findUnique({
    where: { id: questionId },
    select: { ...questionCard, answers: { select: answerShape } },
  });
  if (!question) throw new HttpError(404, 'Question introuvable');
  await requireCourseAccess(user, question.courseId);
  // Accepted answers first, then most-upvoted, then oldest.
  question.answers.sort((a, b) =>
    Number(b.isAccepted) - Number(a.isAccepted)
    || b.upvotes.length - a.upvotes.length
    || new Date(a.createdAt) - new Date(b.createdAt));
  return question;
}

// ─── Write ───
export async function createQuestion(user, courseId, { title, body, lessonId }) {
  if (!title?.trim() || !body?.trim()) throw new HttpError(400, 'Titre et question requis');
  const { course, isOwner } = await requireCourseAccess(user, courseId);
  const question = await prisma.courseQuestion.create({
    data: {
      courseId,
      lessonId: lessonId || null,
      authorId: user.sub,
      title: title.trim(),
      body: body.trim(),
    },
    select: questionCard,
  });
  // Notify the teacher when a student asks (not when the teacher posts).
  if (!isOwner) {
    notifyUser(course.teacherId, {
      type: 'INFO',
      title: 'Nouvelle question 💬',
      body: `« ${title.trim().slice(0, 80)} » — ${course.title}`,
      link: `/online/course/${courseId}`,
    }).catch(() => {});
  }
  // Live-refresh the forum for anyone viewing this course.
  broadcast('qa:update', { courseId });
  return question;
}

export async function createAnswer(user, questionId, { body }) {
  if (!body?.trim()) throw new HttpError(400, 'Réponse vide');
  const question = await prisma.courseQuestion.findUnique({
    where: { id: questionId },
    select: { id: true, courseId: true, authorId: true, title: true },
  });
  if (!question) throw new HttpError(404, 'Question introuvable');
  const { course, isOwner } = await requireCourseAccess(user, question.courseId);
  const answer = await prisma.courseAnswer.create({
    data: {
      questionId,
      authorId: user.sub,
      body: body.trim(),
      isInstructor: isOwner,
    },
    select: answerShape,
  });
  // Notify the question's author (unless they answered themselves).
  if (question.authorId !== user.sub) {
    notifyUser(question.authorId, {
      type: 'INFO',
      title: isOwner ? "Réponse de l'enseignant ✅" : 'Nouvelle réponse 💬',
      body: `Sur votre question « ${question.title.slice(0, 60)} » — ${course.title}`,
      link: `/online/course/${question.courseId}`,
    }).catch(() => {});
  }
  // Live-refresh the forum (list counts + open thread).
  broadcast('qa:update', { courseId: question.courseId, questionId });
  return answer;
}

// ─── Upvotes (toggle) ───
async function toggleUpvote(model, id, userId) {
  const row = await prisma[model].findUnique({ where: { id }, select: { upvotes: true } });
  if (!row) throw new HttpError(404, 'Introuvable');
  const has = row.upvotes.includes(userId);
  const upvotes = has ? row.upvotes.filter((u) => u !== userId) : [...row.upvotes, userId];
  await prisma[model].update({ where: { id }, data: { upvotes } });
  return { upvotes, upvoted: !has };
}

export async function upvoteQuestion(user, questionId) {
  const q = await prisma.courseQuestion.findUnique({ where: { id: questionId }, select: { courseId: true } });
  if (!q) throw new HttpError(404, 'Question introuvable');
  await requireCourseAccess(user, q.courseId);
  return toggleUpvote('courseQuestion', questionId, user.sub);
}

export async function upvoteAnswer(user, answerId) {
  const a = await prisma.courseAnswer.findUnique({
    where: { id: answerId },
    select: { question: { select: { courseId: true } } },
  });
  if (!a) throw new HttpError(404, 'Réponse introuvable');
  await requireCourseAccess(user, a.question.courseId);
  return toggleUpvote('courseAnswer', answerId, user.sub);
}

// ─── Resolve / accept ───
export async function acceptAnswer(user, answerId) {
  const answer = await prisma.courseAnswer.findUnique({
    where: { id: answerId },
    select: { id: true, questionId: true, question: { select: { courseId: true, authorId: true } } },
  });
  if (!answer) throw new HttpError(404, 'Réponse introuvable');
  const { isOwner } = await requireCourseAccess(user, answer.question.courseId);
  // Only the question's author or the course owner may accept an answer.
  if (answer.question.authorId !== user.sub && !isOwner) {
    throw new HttpError(403, 'Seul l\'auteur de la question ou l\'enseignant peut accepter une réponse');
  }
  await prisma.$transaction([
    prisma.courseAnswer.updateMany({ where: { questionId: answer.questionId }, data: { isAccepted: false } }),
    prisma.courseAnswer.update({ where: { id: answerId }, data: { isAccepted: true } }),
    prisma.courseQuestion.update({ where: { id: answer.questionId }, data: { resolved: true } }),
  ]);
  broadcast('qa:update', { courseId: answer.question.courseId, questionId: answer.questionId });
  return getQuestion(user, answer.questionId);
}

export async function setResolved(user, questionId, resolved) {
  const question = await prisma.courseQuestion.findUnique({
    where: { id: questionId },
    select: { courseId: true, authorId: true },
  });
  if (!question) throw new HttpError(404, 'Question introuvable');
  const { isOwner } = await requireCourseAccess(user, question.courseId);
  if (question.authorId !== user.sub && !isOwner) throw new HttpError(403, 'Action non autorisée');
  return prisma.courseQuestion.update({
    where: { id: questionId },
    data: { resolved: Boolean(resolved) },
    select: questionCard,
  });
}

// ─── Delete ───
export async function deleteQuestion(user, questionId) {
  const question = await prisma.courseQuestion.findUnique({
    where: { id: questionId },
    select: { courseId: true, authorId: true },
  });
  if (!question) throw new HttpError(404, 'Question introuvable');
  const { isOwner } = await requireCourseAccess(user, question.courseId);
  if (question.authorId !== user.sub && !isOwner) throw new HttpError(403, 'Action non autorisée');
  await prisma.courseQuestion.delete({ where: { id: questionId } });
  return { ok: true };
}

export async function deleteAnswer(user, answerId) {
  const answer = await prisma.courseAnswer.findUnique({
    where: { id: answerId },
    select: { authorId: true, question: { select: { courseId: true } } },
  });
  if (!answer) throw new HttpError(404, 'Réponse introuvable');
  const { isOwner } = await requireCourseAccess(user, answer.question.courseId);
  if (answer.authorId !== user.sub && !isOwner) throw new HttpError(403, 'Action non autorisée');
  await prisma.courseAnswer.delete({ where: { id: answerId } });
  return { ok: true };
}
