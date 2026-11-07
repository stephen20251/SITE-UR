import { prisma } from '../../database/prisma.js';

// Points are derived from existing learning data — no extra bookkeeping tables.
const POINTS = {
  lessonCompleted: 10,
  quizPassed: 25,
  courseCompleted: 100,
  certificate: 150,
  reviewWritten: 5,
  questionAsked: 5,
  answerGiven: 10,
  acceptedAnswer: 25,
};

const BADGES = [
  { id: 'first-steps',   label: 'Premiers pas',      icon: '🎯', desc: 'Première leçon terminée',        test: (s) => s.lessonsCompleted >= 1 },
  { id: 'assiduous',     label: 'Assidu',            icon: '📚', desc: '25 leçons terminées',            test: (s) => s.lessonsCompleted >= 25 },
  { id: 'quiz-master',   label: 'Maître des quiz',   icon: '🧠', desc: '5 quiz réussis',                 test: (s) => s.quizzesPassed >= 5 },
  { id: 'graduate',      label: 'Diplômé',           icon: '🎓', desc: 'Premier cours terminé',          test: (s) => s.coursesCompleted >= 1 },
  { id: 'collector',     label: 'Collectionneur',    icon: '🏆', desc: '3 certificats obtenus',          test: (s) => s.certificates >= 3 },
  { id: 'critic',        label: 'Critique',          icon: '⭐', desc: 'Premier avis publié',            test: (s) => s.reviews >= 1 },
  { id: 'curious',       label: 'Curieux',           icon: '❓', desc: 'Première question posée',        test: (s) => s.questions >= 1 },
  { id: 'helper',        label: 'Entraide',          icon: '🤝', desc: '5 réponses données',             test: (s) => s.answers >= 5 },
  { id: 'expert',        label: 'Expert reconnu',    icon: '💎', desc: 'Une réponse acceptée',           test: (s) => s.acceptedAnswers >= 1 },
  { id: 'on-fire',       label: 'En feu',            icon: '🔥', desc: 'Série de 7 jours',               test: (s) => s.streak >= 7 },
];

const LEVELS = [
  { level: 1, label: 'Débutant',    min: 0 },
  { level: 2, label: 'Apprenti',    min: 100 },
  { level: 3, label: 'Étudiant',    min: 300 },
  { level: 4, label: 'Confirmé',    min: 700 },
  { level: 5, label: 'Avancé',      min: 1500 },
  { level: 6, label: 'Expert',      min: 3000 },
  { level: 7, label: 'Maître',      min: 6000 },
];

async function rawStats(studentId) {
  const [lessonsCompleted, quizzesPassed, coursesCompleted, certificates, reviews, questions, answers, acceptedAnswers] =
    await Promise.all([
      prisma.onlineLessonProgress.count({ where: { completed: true, enrollment: { studentId } } }),
      prisma.onlineQuizAttempt.count({ where: { studentId, passed: true } }),
      prisma.enrollment.count({ where: { studentId, completedAt: { not: null } } }),
      prisma.onlineCertificate.count({ where: { studentId } }),
      prisma.courseReview.count({ where: { studentId } }),
      prisma.courseQuestion.count({ where: { authorId: studentId } }),
      prisma.courseAnswer.count({ where: { authorId: studentId } }),
      prisma.courseAnswer.count({ where: { authorId: studentId, isAccepted: true } }),
    ]);
  return { lessonsCompleted, quizzesPassed, coursesCompleted, certificates, reviews, questions, answers, acceptedAnswers };
}

// Streak: consecutive active days ending today (same logic as activity stats).
async function computeStreak(studentId) {
  const acts = await prisma.learningActivity.findMany({
    where: { studentId, createdAt: { gte: new Date(Date.now() - 60 * 86_400_000) } },
    select: { createdAt: true },
  });
  const days = new Set(acts.map((a) => a.createdAt.toISOString().slice(0, 10)));
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (days.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

function pointsOf(s) {
  return s.lessonsCompleted * POINTS.lessonCompleted
    + s.quizzesPassed * POINTS.quizPassed
    + s.coursesCompleted * POINTS.courseCompleted
    + s.certificates * POINTS.certificate
    + s.reviews * POINTS.reviewWritten
    + s.questions * POINTS.questionAsked
    + s.answers * POINTS.answerGiven
    + s.acceptedAnswers * POINTS.acceptedAnswer;
}

function levelOf(points) {
  let current = LEVELS[0];
  for (const l of LEVELS) if (points >= l.min) current = l;
  const next = LEVELS.find((l) => l.min > points) ?? null;
  return {
    level: current.level,
    label: current.label,
    nextLevelAt: next?.min ?? null,
    progressToNext: next ? Math.round(((points - current.min) / (next.min - current.min)) * 100) : 100,
  };
}

export async function myGamification(studentId) {
  const [stats, streak] = await Promise.all([rawStats(studentId), computeStreak(studentId)]);
  const full = { ...stats, streak };
  const points = pointsOf(stats);
  return {
    points,
    ...levelOf(points),
    streak,
    stats,
    badges: BADGES.map((b) => ({ id: b.id, label: b.label, icon: b.icon, desc: b.desc, earned: b.test(full) })),
  };
}

// Top learners by points. Computed over students with any activity — the
// catalogue is small-scale, so an on-the-fly ranking is fine.
export async function leaderboard(limit = 10) {
  const students = await prisma.user.findMany({
    where: { systemRole: 'STUDENT_ONLINE', isActive: true },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });
  const rows = await Promise.all(
    students.map(async (u) => {
      const s = await rawStats(u.id);
      return { id: u.id, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.avatarUrl, points: pointsOf(s), certificates: s.certificates, coursesCompleted: s.coursesCompleted };
    })
  );
  return rows
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, limit)
    .map((r, i) => ({ rank: i + 1, ...r, ...levelOf(r.points) }));
}
