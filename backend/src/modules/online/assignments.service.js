import { prisma } from '../../database/prisma.js';
import { isOnlineTeacher } from '../../middlewares/auth.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { getCourseOwned, getEnrollmentOrThrow, isSuperAdmin } from './online.guards.js';
import { notifyUser, notifyUsers } from '../../utils/notify.js';
import { logActivity, tryIssueCertificate } from './enrollment.service.js';

// ─── Fichiers joints (énoncés, exercices) ───
async function getAssignmentOwned(assignmentId, teacherId) {
  const asgn = await prisma.onlineAssignment.findUnique({
    where: { id: assignmentId },
    include: { course: { select: { teacherId: true } } },
  });
  if (!asgn) throw new HttpError(404, 'Devoir introuvable');
  if (asgn.course.teacherId !== teacherId && !(await isSuperAdmin(teacherId))) throw new HttpError(403, 'Forbidden');
  return asgn;
}

export async function addAttachment(assignmentId, teacherId, file) {
  const asgn = await getAssignmentOwned(assignmentId, teacherId);
  const list = Array.isArray(asgn.attachments) ? asgn.attachments : [];
  return prisma.onlineAssignment.update({
    where: { id: assignmentId },
    data: { attachments: [...list, file] },
  });
}

export async function removeAttachment(assignmentId, teacherId, url) {
  const asgn = await getAssignmentOwned(assignmentId, teacherId);
  const list = Array.isArray(asgn.attachments) ? asgn.attachments : [];
  return prisma.onlineAssignment.update({
    where: { id: assignmentId },
    data: { attachments: list.filter((f) => f?.url !== url) },
  });
}

// ─── Teacher ───
export async function createAssignment(courseId, teacherId, input) {
  await getCourseOwned(courseId, teacherId);

  const assignment = await prisma.onlineAssignment.create({
    data: {
      courseId,
      moduleId: input.moduleId,
      title: input.title,
      description: input.description,
      dueDate: new Date(input.dueDate),
      maxScore: input.maxScore ?? 20,
      fileUrl: input.fileUrl,
      peerReview: input.peerReview ?? false,
    },
  });

  const enrolled = await prisma.enrollment.findMany({ where: { courseId }, select: { studentId: true } });
  notifyUsers(
    enrolled.map((e) => e.studentId),
    {
      type: 'ANNOUNCEMENT',
      title: 'New assignment',
      body: `${input.title} — due ${new Date(input.dueDate).toLocaleDateString('fr-FR')}`,
      data: { courseId, assignmentId: assignment.id },
    },
  ).catch(() => {});

  return assignment;
}

export async function updateAssignment(assignmentId, teacherId, patch) {
  const asgn = await prisma.onlineAssignment.findUnique({
    where: { id: assignmentId },
    include: { course: { select: { teacherId: true } } },
  });
  if (!asgn) throw new HttpError(404, 'Assignment not found');
  if (asgn.course.teacherId !== teacherId && !await isSuperAdmin(teacherId)) throw new HttpError(403, 'Not your assignment');

  const { title, description, dueDate, maxScore, fileUrl, status } = patch;
  return prisma.onlineAssignment.update({
    where: { id: assignmentId },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
      ...(maxScore !== undefined && { maxScore }),
      ...(fileUrl !== undefined && { fileUrl }),
      ...(status !== undefined && { status }),
    },
  });
}

export async function deleteAssignment(assignmentId, teacherId) {
  const asgn = await prisma.onlineAssignment.findUnique({
    where: { id: assignmentId },
    include: { course: { select: { teacherId: true } } },
  });
  if (!asgn) throw new HttpError(404, 'Assignment not found');
  if (asgn.course.teacherId !== teacherId && !await isSuperAdmin(teacherId)) throw new HttpError(403, 'Not your assignment');
  await prisma.onlineAssignment.delete({ where: { id: assignmentId } });
}

export async function listForCourse(courseId, user) {
  const course = await prisma.onlineCourse.findUnique({ where: { id: courseId }, select: { teacherId: true } });
  if (!course) throw new HttpError(404, 'Course not found');

  const isOwner = (isOnlineTeacher(user) && course.teacherId === user.sub)
    || user.role === 'SUPER_ADMIN' || user.systemRole === 'SUPER_ADMIN';
  if (!isOwner) await getEnrollmentOrThrow(user.sub, courseId);

  const assignments = await prisma.onlineAssignment.findMany({
    where: { courseId },
    orderBy: { dueDate: 'asc' },
    include: {
      module: { select: { id: true, title: true } },
      _count: { select: { submissions: true } },
    },
  });

  if (!isOwner) {
    const submissions = await prisma.onlineSubmission.findMany({
      where: { studentId: user.sub, assignmentId: { in: assignments.map((a) => a.id) } },
      select: { assignmentId: true, status: true, score: true, submittedAt: true },
    });
    const subMap = new Map(submissions.map((s) => [s.assignmentId, s]));
    return assignments.map((a) => ({ ...a, submission: subMap.get(a.id) ?? null }));
  }

  return assignments;
}

// ─── Student: all pending assignments across enrolled courses ───
export async function myPendingAssignments(studentId) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    select: { courseId: true },
  });
  const courseIds = enrollments.map((e) => e.courseId);
  if (!courseIds.length) return [];

  const assignments = await prisma.onlineAssignment.findMany({
    where: {
      courseId: { in: courseIds },
      status: 'OPEN',
      dueDate: { gte: new Date() },
    },
    orderBy: { dueDate: 'asc' },
    include: {
      course: { select: { id: true, title: true, slug: true, thumbnail: true } },
      module: { select: { id: true, title: true } },
    },
  });

  const submissions = await prisma.onlineSubmission.findMany({
    where: { studentId, assignmentId: { in: assignments.map((a) => a.id) } },
    select: { assignmentId: true, status: true, score: true },
  });
  const subMap = new Map(submissions.map((s) => [s.assignmentId, s]));

  return assignments.map((a) => ({ ...a, submission: subMap.get(a.id) ?? null }));
}

// ─── Student: submit assignment ───
export async function submitAssignment(assignmentId, studentId, input) {
  const asgn = await prisma.onlineAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, courseId: true, status: true, dueDate: true, course: { select: { teacherId: true } } },
  });
  if (!asgn) throw new HttpError(404, 'Assignment not found');
  if (asgn.status === 'CLOSED') throw new HttpError(422, 'Assignment is closed');
  await getEnrollmentOrThrow(studentId, asgn.courseId);

  const submission = await prisma.onlineSubmission.upsert({
    where: { assignmentId_studentId: { assignmentId, studentId } },
    create: { assignmentId, studentId, fileUrl: input.fileUrl, content: input.content, submittedAt: new Date() },
    update: { fileUrl: input.fileUrl, content: input.content, status: 'SUBMITTED', submittedAt: new Date() },
  });

  await logActivity(studentId, asgn.courseId, null, null, 'assignment_submit', { assignmentId });

  // Check whether all cert conditions are now met
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId: asgn.courseId } },
    select: { id: true },
  });
  let certificate = null;
  if (enrollment) {
    certificate = await tryIssueCertificate(studentId, enrollment.id, asgn.courseId).catch(() => null);
  }

  notifyUser(asgn.course.teacherId, {
    type: 'INFO',
    title: 'New submission',
    body: `A student submitted assignment`,
    data: { courseId: asgn.courseId, assignmentId },
  }).catch(() => {});

  return { ...submission, certificate };
}

// ─── Teacher: grade a submission ───
export async function gradeSubmission(submissionId, teacherId, { score, feedback }) {
  const sub = await prisma.onlineSubmission.findUnique({
    where: { id: submissionId },
    include: { assignment: { include: { course: { select: { teacherId: true } } } } },
  });
  if (!sub) throw new HttpError(404, 'Submission not found');
  if (sub.assignment.course.teacherId !== teacherId && !await isSuperAdmin(teacherId)) throw new HttpError(403, 'Not your course');

  const updated = await prisma.onlineSubmission.update({
    where: { id: submissionId },
    data: { score, feedback, status: 'GRADED', gradedAt: new Date() },
  });

  notifyUser(sub.studentId, {
    type: 'SUCCESS',
    title: 'Assignment graded',
    body: `Score: ${score}/${sub.assignment.maxScore}`,
    data: { assignmentId: sub.assignmentId },
  }).catch(() => {});

  return updated;
}

// ─── Teacher: list submissions for an assignment ───
export async function listSubmissions(assignmentId, teacherId) {
  const asgn = await prisma.onlineAssignment.findUnique({
    where: { id: assignmentId },
    include: { course: { select: { teacherId: true } } },
  });
  if (!asgn) throw new HttpError(404, 'Assignment not found');
  if (asgn.course.teacherId !== teacherId && !await isSuperAdmin(teacherId)) throw new HttpError(403, 'Not your assignment');

  return prisma.onlineSubmission.findMany({
    where: { assignmentId },
    orderBy: { submittedAt: 'desc' },
  });
}


// ─── Peer review ─────────────────────────────────────────────────────────────
// Students who submitted review their peers' submissions (blind: no names).

async function getPeerAssignment(assignmentId, studentId) {
  const assignment = await prisma.onlineAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, courseId: true, maxScore: true, peerReview: true },
  });
  if (!assignment) throw new HttpError(404, 'Devoir introuvable');
  if (!assignment.peerReview) throw new HttpError(400, "Ce devoir n'est pas en évaluation par les pairs");
  const mine = await prisma.onlineSubmission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId } },
    select: { id: true },
  });
  if (!mine) throw new HttpError(403, 'Soumettez votre devoir avant d\'évaluer vos pairs');
  return assignment;
}

// Up to 3 anonymous peer submissions the student hasn't reviewed yet.
export async function peerQueue(assignmentId, studentId) {
  await getPeerAssignment(assignmentId, studentId);
  const reviewed = await prisma.peerReview.findMany({
    where: { reviewerId: studentId, submission: { assignmentId } },
    select: { submissionId: true },
  });
  const items = await prisma.onlineSubmission.findMany({
    where: {
      assignmentId,
      studentId: { not: studentId },
      id: { notIn: reviewed.map((r) => r.submissionId) },
    },
    select: { id: true, content: true, fileUrl: true, submittedAt: true },
    orderBy: { submittedAt: 'asc' },
    take: 3,
  });
  return { items, reviewedCount: reviewed.length };
}

export async function submitPeerReview(submissionId, studentId, { score, comment }) {
  const submission = await prisma.onlineSubmission.findUnique({
    where: { id: submissionId },
    select: { id: true, assignmentId: true, studentId: true },
  });
  if (!submission) throw new HttpError(404, 'Soumission introuvable');
  if (submission.studentId === studentId) throw new HttpError(400, 'Impossible d\'évaluer sa propre soumission');
  const assignment = await getPeerAssignment(submission.assignmentId, studentId);
  const n = Number(score);
  if (!(n >= 0) || n > assignment.maxScore) throw new HttpError(400, `Note invalide (0 à ${assignment.maxScore})`);
  const review = await prisma.peerReview.upsert({
    where: { submissionId_reviewerId: { submissionId, reviewerId: studentId } },
    create: { submissionId, reviewerId: studentId, score: n, comment: comment?.trim() || null },
    update: { score: n, comment: comment?.trim() || null },
  });
  notifyUser(submission.studentId, {
    type: 'INFO',
    title: 'Votre devoir a été évalué par un pair 🤝',
    body: `Note reçue : ${n}/${assignment.maxScore}`,
    link: `/online/course/${assignment.courseId}`,
  }).catch(() => {});
  return review;
}

// Peer feedback on the student's own submission (anonymous reviewers).
export async function myPeerFeedback(assignmentId, studentId) {
  const mine = await prisma.onlineSubmission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId } },
    select: { id: true, assignment: { select: { maxScore: true } } },
  });
  if (!mine) return { reviews: [], avg: null };
  const reviews = await prisma.peerReview.findMany({
    where: { submissionId: mine.id },
    select: { score: true, comment: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  const avg = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.score, 0) / reviews.length) * 100) / 100
    : null;
  return { reviews, avg, maxScore: mine.assignment.maxScore };
}
