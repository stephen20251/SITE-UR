import { prisma } from '../../database/prisma.js'
import { HttpError } from '../../utils/asyncHandler.js'

const COURSE_INCLUDE = {
  subject: { select: { id: true, name: true, code: true } },
  promotion: { select: { id: true, name: true, level: true } },
  teachers: { include: { teacher: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } } } },
  _count: { select: { chapters: true, assignments: true } },
}

export const listCourses = async (req, res) => {
  const { promotionId, status, subjectId } = req.query
  const where = {}
  if (promotionId) where.promotionId = promotionId
  if (status) where.status = status
  if (subjectId) where.subjectId = subjectId

  // Teachers see only their courses
  if (req.user.systemRole === 'TEACHER') {
    const tp = await prisma.teacherProfile.findUnique({ where: { userId: req.user.sub } })
    if (tp) where.teachers = { some: { teacherId: tp.id } }
  }

  const courses = await prisma.course.findMany({ where, include: COURSE_INCLUDE, orderBy: { createdAt: 'desc' } })
  res.json(courses)
}

export const getCourse = async (req, res) => {
  const course = await prisma.course.findUnique({
    where: { id: req.params.id },
    include: { ...COURSE_INCLUDE, chapters: { include: { resources: { orderBy: { order: 'asc' } }, quizzes: true }, orderBy: { order: 'asc' } } },
  })
  if (!course) throw new HttpError(404, 'Cours non trouvé')
  res.json(course)
}

export const createCourse = async (req, res) => {
  const course = await prisma.course.create({
    data: { ...req.body, createdBy: req.user.sub, status: 'DRAFT' },
    include: COURSE_INCLUDE,
  })
  res.status(201).json(course)
}

export const updateCourse = async (req, res) => {
  const { status, approvedBy, approvedAt, ...data } = req.body
  const course = await prisma.course.update({ where: { id: req.params.id }, data, include: COURSE_INCLUDE })
  res.json(course)
}

export const deleteCourse = async (req, res) => {
  await prisma.course.update({ where: { id: req.params.id }, data: { status: 'ARCHIVED' } })
  res.json({ ok: true })
}

export const publishCourse = async (req, res) => {
  const course = await prisma.course.update({ where: { id: req.params.id }, data: { status: 'PENDING_APPROVAL' } })
  res.json(course)
}

export const approveCourse = async (req, res) => {
  const course = await prisma.course.update({
    where: { id: req.params.id },
    data: { status: 'PUBLISHED', approvedBy: req.user.sub, approvedAt: new Date() },
  })
  res.json(course)
}

export const assignTeacher = async (req, res) => {
  const tp = await prisma.teacherProfile.findUnique({ where: { userId: req.body.userId } })
  if (!tp) throw new HttpError(404, 'Profil enseignant non trouvé')
  const ct = await prisma.courseTeacher.create({
    data: { courseId: req.params.id, teacherId: tp.id, isMain: req.body.isMain ?? false, assignedBy: req.user.sub },
  })
  res.status(201).json(ct)
}

export const removeTeacher = async (req, res) => {
  await prisma.courseTeacher.deleteMany({ where: { courseId: req.params.id, teacherId: req.params.teacherId } })
  res.json({ ok: true })
}

// ── Chapters ──────────────────────────────────────────────────────
export const listChapters = async (req, res) => {
  const chapters = await prisma.chapter.findMany({
    where: { courseId: req.params.courseId },
    include: { resources: { orderBy: { order: 'asc' } }, quizzes: { select: { id: true, title: true, isPublished: true } } },
    orderBy: { order: 'asc' },
  })
  res.json(chapters)
}

export const createChapter = async (req, res) => {
  const ch = await prisma.chapter.create({ data: { ...req.body, courseId: req.params.courseId } })
  res.status(201).json(ch)
}

export const updateChapter = async (req, res) => {
  const ch = await prisma.chapter.update({ where: { id: req.params.id }, data: req.body })
  res.json(ch)
}

export const deleteChapter = async (req, res) => {
  await prisma.chapter.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
}

// ── Resources ─────────────────────────────────────────────────────
export const listResources = async (req, res) => {
  const resources = await prisma.resource.findMany({
    where: { chapterId: req.params.chapterId },
    orderBy: { order: 'asc' },
  })
  res.json(resources)
}

export const createResource = async (req, res) => {
  const res_ = await prisma.resource.create({ data: { ...req.body, chapterId: req.params.chapterId } })
  res.status(201).json(res_)
}

export const updateResource = async (req, res) => {
  const r = await prisma.resource.update({ where: { id: req.params.id }, data: req.body })
  res.json(r)
}

export const deleteResource = async (req, res) => {
  await prisma.resource.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
}

export const markProgress = async (req, res) => {
  const sp = await prisma.studentProfile.findUnique({ where: { userId: req.user.sub } })
  if (!sp) throw new HttpError(403, 'Profil étudiant requis')

  const prog = await prisma.lessonProgress.upsert({
    where: { studentId_resourceId: { studentId: sp.id, resourceId: req.params.id } },
    update: {
      completed: req.body.completed ?? false,
      watchedSecs: req.body.watchedSecs ?? 0,
      completedAt: req.body.completed ? new Date() : null,
    },
    create: {
      studentId: sp.id, resourceId: req.params.id,
      completed: req.body.completed ?? false,
      watchedSecs: req.body.watchedSecs ?? 0,
      completedAt: req.body.completed ? new Date() : null,
    },
  })
  res.json(prog)
}

// ── Assignments ───────────────────────────────────────────────────
export const listAssignments = async (req, res) => {
  const assignments = await prisma.assignment.findMany({
    where: { courseId: req.params.courseId },
    include: { _count: { select: { submissions: true } } },
    orderBy: { dueDate: 'asc' },
  })
  res.json(assignments)
}

export const createAssignment = async (req, res) => {
  const a = await prisma.assignment.create({ data: { ...req.body, courseId: req.params.courseId, status: 'DRAFT' } })
  res.status(201).json(a)
}

export const submitAssignment = async (req, res) => {
  const sp = await prisma.studentProfile.findUnique({ where: { userId: req.user.sub } })
  if (!sp) throw new HttpError(403, 'Profil étudiant requis')
  const submission = await prisma.submission.upsert({
    where: { assignmentId_studentId: { assignmentId: req.params.id, studentId: sp.id } },
    update: { ...req.body, status: 'SUBMITTED', submittedAt: new Date() },
    create: { assignmentId: req.params.id, studentId: sp.id, ...req.body, status: 'SUBMITTED' },
  })
  res.status(201).json(submission)
}

export const gradeSubmission = async (req, res) => {
  const submission = await prisma.submission.updateMany({
    where: { assignmentId: req.params.id, studentId: req.params.studentId },
    data: { score: req.body.score, feedback: req.body.feedback, status: 'GRADED', gradedAt: new Date() },
  })
  res.json(submission)
}
