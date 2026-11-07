import { prisma } from '../../database/prisma.js';
import { myPendingAssignments } from './assignments.service.js';
import { myPendingQuizzes } from './quizzes.service.js';

// Recent activity for the student dashboard
export async function myActivity(studentId, limit = 20) {
  const activities = await prisma.learningActivity.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      course: { select: { id: true, title: true, slug: true, thumbnail: true } },
      lesson: { select: { id: true, title: true, type: true } },
    },
  });
  return activities;
}

// Weekly activity heatmap (last 7 days)
export async function weeklyActivity(studentId) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const activities = await prisma.learningActivity.findMany({
    where: { studentId, createdAt: { gte: since } },
    select: { createdAt: true, action: true },
    orderBy: { createdAt: 'asc' },
  });

  // Group by day
  const byDay = {};
  for (const a of activities) {
    const day = a.createdAt.toISOString().slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;
  }
  return byDay;
}

// Student dashboard stats: streak, study estimate, progress, pending
export async function studentStats(studentId) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

  // Study actions (significant ones)
  const STUDY_ACTIONS = ['lesson_open', 'video_complete', 'pdf_open', 'quiz_start', 'quiz_complete', 'assignment_submit'];

  const [todayActs, weekActs, allActs, enrollments, pendingAssignments, pendingQuizzes] = await Promise.all([
    prisma.learningActivity.count({
      where: { studentId, action: { in: STUDY_ACTIONS }, createdAt: { gte: todayStart } },
    }),
    prisma.learningActivity.count({
      where: { studentId, action: { in: STUDY_ACTIONS }, createdAt: { gte: weekStart } },
    }),
    // Last 60 days for streak
    prisma.learningActivity.findMany({
      where: { studentId, action: { in: STUDY_ACTIONS }, createdAt: { gte: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) } },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.enrollment.findMany({
      where: { studentId },
      select: { progress: true },
    }),
    // Reuse the dashboard's own "pending" queries — the models here are
    // OnlineAssignment/Quiz (there is no `assignmentSubmission`/`quizAttempt`
    // delegate), and these helpers already encode the right rules.
    myPendingAssignments(studentId).then((a) => a.length).catch(() => 0),
    myPendingQuizzes(studentId).then((q) => q.length).catch(() => 0),
  ]);

  // Streak: consecutive days of activity up to today
  const activeDays = new Set(allActs.map(a => a.createdAt.toISOString().slice(0, 10)));
  let streak = 0;
  const d = new Date(todayStart);
  while (activeDays.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  // Global progress: average across all enrollments
  const progressionGlobale = enrollments.length
    ? Math.round(enrollments.reduce((s, e) => s + e.progress, 0) / enrollments.length)
    : 0;

  // Study time estimate: 15 min per significant action
  const todayMinutes = todayActs * 15;
  const weekMinutes = weekActs * 15;
  const weekGoalMinutes = 120; // 2 hours per week default

  return {
    streak,
    progressionGlobale,
    todayMinutes,
    weekMinutes,
    weekGoalMinutes,
    pendingAssignments,
    pendingQuizzes,
    coursesTotal: enrollments.length,
  };
}
