import { prisma } from '../../database/prisma.js'
import { HttpError } from '../../utils/asyncHandler.js'
import { isSemesterFinished } from '../../utils/roles.js'


// Restreint la recherche selon le rôle : un étudiant ne voit que lui-même, un parent
// que ses enfants (studentId peut être l'id du profil ou l'id utilisateur de l'enfant).
async function scopeStudent(req, studentId) {
  const role = req.user.systemRole
  if (role === 'STUDENT') {
    const sp = await prisma.studentProfile.findUnique({ where: { userId: req.user.sub } })
    if (!sp) throw new HttpError(403, 'Profil étudiant requis')
    return sp.id
  }
  if (role === 'PARENT') {
    const links = await prisma.parentLink.findMany({
      where: { parent: { userId: req.user.sub } },
      select: { student: { select: { id: true, userId: true } } },
    })
    const child = studentId
      ? links.find((l) => l.student.id === studentId || l.student.userId === studentId)
      : links[0]
    if (!child) throw new HttpError(403, 'Accès refusé')
    return child.student.id
  }
  if (['CANDIDATE', 'STUDENT_ONLINE', 'TEACHER_ONLINE'].includes(role)) throw new HttpError(403, 'Accès refusé')
  if (!studentId) return undefined
  const sp = await prisma.studentProfile.findFirst({ where: { OR: [{ id: studentId }, { userId: studentId }] }, select: { id: true } })
  return sp?.id ?? studentId
}

export const listGrades = async (req, res) => {
  const { studentId, subjectId, semesterId } = req.query
  const where = {}
  if (subjectId) where.subjectId = subjectId
  if (semesterId) where.semesterId = semesterId

  const sid = await scopeStudent(req, studentId)
  if (sid) where.studentId = sid

  const grades = await prisma.grade.findMany({
    where,
    include: {
      subject: { select: { id: true, name: true, code: true, credits: true } },
      student: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(grades)
}

export const createGrade = async (req, res) => {
  const tp = await prisma.teacherProfile.findUnique({ where: { userId: req.user.sub } })
  const grade = await prisma.grade.create({
    data: { ...req.body, teacherId: tp?.id ?? null },
  })
  res.status(201).json(grade)
}

export const updateGrade = async (req, res) => {
  const grade = await prisma.grade.update({ where: { id: req.params.id }, data: req.body })
  res.json(grade)
}

export const deleteGrade = async (req, res) => {
  await prisma.grade.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
}

export const validateGrade = async (req, res) => {
  const grade = await prisma.grade.update({
    where: { id: req.params.id },
    data: { isValidated: true, validatedBy: req.user.sub },
  })
  res.json(grade)
}

export const getBulletin = async (req, res) => {
  const { studentId, semesterId } = req.params
  const sp = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: { user: { select: { firstName: true, lastName: true } }, promotion: true, mention: true },
  })
  if (!sp) throw new HttpError(404, 'Étudiant non trouvé')

  // Étudiant : uniquement son bulletin ; parent : celui de ses enfants. Dans les deux
  // cas, le bulletin n'est publié en ligne qu'une fois le semestre terminé.
  const role = req.user.systemRole
  if (role === 'STUDENT' || role === 'PARENT') {
    const allowed = role === 'STUDENT'
      ? sp.userId === req.user.sub
      : !!(await prisma.parentLink.findFirst({ where: { studentId, parent: { userId: req.user.sub } } }))
    if (!allowed) throw new HttpError(403, 'Accès refusé')
    const semester = await prisma.semester.findUnique({ where: { id: semesterId }, select: { endDate: true, name: true, isActive: true } })
    if (!semester) throw new HttpError(404, 'Semestre introuvable')
    if (!isSemesterFinished(semester)) {
      throw new HttpError(423, `Le bulletin du ${semester.name} sera disponible une fois le semestre terminé et clôturé par l'administration.`)
    }
  } else if (role === 'CANDIDATE' || role === 'STUDENT_ONLINE' || role === 'TEACHER_ONLINE') {
    throw new HttpError(403, 'Accès refusé')
  }

  const grades = await prisma.grade.findMany({
    where: { studentId, semesterId },
    include: { subject: { select: { name: true, code: true, credits: true } } },
  })

  // Group by subject and compute averages
  const subjectMap = {}
  for (const g of grades) {
    const key = g.subjectId
    if (!subjectMap[key]) {
      subjectMap[key] = { subject: g.subject, grades: [], average: 0, credits: g.subject.credits }
    }
    subjectMap[key].grades.push(g)
  }

  let totalCredits = 0, earnedCredits = 0, weightedSum = 0
  const results = Object.values(subjectMap).map(s => {
    const weighted = s.grades.reduce((sum, g) => sum + g.value * g.coefficient, 0)
    const totalCoeff = s.grades.reduce((sum, g) => sum + g.coefficient, 0)
    const avg = totalCoeff > 0 ? weighted / totalCoeff : 0
    s.average = Math.round(avg * 100) / 100
    totalCredits += s.credits
    if (avg >= 10) earnedCredits += s.credits
    weightedSum += avg * s.credits
    return s
  })

  const gpa = totalCredits > 0 ? Math.round(weightedSum / totalCredits * 100) / 100 : 0

  res.json({
    student: sp,
    semesterId,
    results,
    summary: { gpa, totalCredits, earnedCredits, passed: gpa >= 10 },
  })
}

// ── Class-level grade sheet ───────────────────────────────────────────────────
// Returns students with their grades for a specific subject+type+semester
export const getClassGrades = async (req, res) => {
  const { subjectId, groupId, promotionId, semesterId, type } = req.query
  if (!subjectId) throw new HttpError(400, 'subjectId requis')

  // Build student filter
  const studentWhere = {}
  if (groupId)     studentWhere.groupId     = groupId
  if (promotionId) studentWhere.promotionId = promotionId

  const [students, grades] = await Promise.all([
    prisma.studentProfile.findMany({
      where: studentWhere,
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    }),
    prisma.grade.findMany({
      where: {
        subjectId,
        ...(semesterId && { semesterId }),
        ...(type       && { type }),
        ...(groupId     ? { student: { groupId } }     : {}),
        ...(promotionId ? { student: { promotionId } } : {}),
      },
    }),
  ])

  // Map grades by studentId
  const gradeMap = {}
  for (const g of grades) {
    if (!gradeMap[g.studentId]) gradeMap[g.studentId] = {}
    gradeMap[g.studentId][g.type] = g
  }

  res.json(students.map(s => ({ student: s, gradeMap: gradeMap[s.id] ?? {} })))
}

// ── Bulk upsert grades ────────────────────────────────────────────────────────
export const bulkUpsertGrades = async (req, res) => {
  const { entries } = req.body
  if (!Array.isArray(entries) || !entries.length) throw new HttpError(400, 'entries requis')

  const tp = await prisma.teacherProfile.findUnique({ where: { userId: req.user.sub } })
  let saved = 0

  for (const e of entries) {
    const { studentId, subjectId, semesterId, type, value, coefficient, maxValue, comment } = e
    const gradeType = type ?? 'CONTINUOUS'
    const semId = semesterId ?? null

    // Find most recent grade of this type (no unique constraint — find first match)
    const existing = await prisma.grade.findFirst({
      where: { studentId, subjectId, semesterId: semId, type: gradeType },
      orderBy: { createdAt: 'desc' },
    })

    if (existing) {
      await prisma.grade.update({
        where: { id: existing.id },
        data: {
          value: parseFloat(value), maxValue: parseFloat(maxValue ?? 20),
          coefficient: parseFloat(coefficient ?? 1),
          comment: comment ?? null,
        },
      })
    } else {
      await prisma.grade.create({
        data: {
          studentId, subjectId, semesterId: semId,
          type: gradeType,
          value: parseFloat(value), maxValue: parseFloat(maxValue ?? 20),
          coefficient: parseFloat(coefficient ?? 1),
          comment: comment ?? null,
          teacherId: tp?.id ?? null,
        },
      })
    }
    saved++
  }

  res.json({ saved })
}

// ── Averages per student for a semester ──────────────────────────────────────
export const getSemesterAverages = async (req, res) => {
  const { promotionId, groupId, semesterId } = req.query
  if (!semesterId) throw new HttpError(400, 'semesterId requis')

  const studentWhere = {}
  if (groupId)     studentWhere.groupId     = groupId
  if (promotionId) studentWhere.promotionId = promotionId

  const students = await prisma.studentProfile.findMany({
    where: studentWhere,
    include: {
      user:   { select: { firstName: true, lastName: true } },
      grades: {
        where: { semesterId },
        include: { subject: { select: { id: true, name: true, code: true, credits: true } } },
      },
    },
    orderBy: { user: { lastName: 'asc' } },
  })

  const results = students.map(s => {
    // Group grades by subject
    const bySubject = {}
    for (const g of s.grades) {
      if (!bySubject[g.subjectId]) bySubject[g.subjectId] = { subject: g.subject, grades: [] }
      bySubject[g.subjectId].grades.push(g)
    }

    let totalCredits = 0, earnedCredits = 0, weightedSum = 0
    const subjects = Object.values(bySubject).map(({ subject, grades: sg }) => {
      const weighted   = sg.reduce((sum, g) => sum + g.value * g.coefficient, 0)
      const totalCoeff = sg.reduce((sum, g) => sum + g.coefficient, 0)
      const avg = totalCoeff > 0 ? +(weighted / totalCoeff).toFixed(2) : null
      totalCredits += subject.credits
      if (avg !== null && avg >= 10) earnedCredits += subject.credits
      if (avg !== null) weightedSum += avg * subject.credits
      return { subject, avg }
    })

    const gpa = totalCredits > 0 ? +(weightedSum / totalCredits).toFixed(2) : null
    return {
      student: { id: s.id, matricule: s.matricule, user: s.user },
      subjects,
      summary: { gpa, totalCredits, earnedCredits, passed: gpa !== null && gpa >= 10 },
    }
  })

  res.json(results)
}

export const listAttendance = async (req, res) => {
  const { studentId, courseId, date } = req.query
  const where = {}
  if (courseId) where.courseId = courseId
  if (date) where.date = { gte: new Date(date) }

  const sid = await scopeStudent(req, studentId)
  if (sid) where.studentId = sid

  const attendance = await prisma.attendance.findMany({
    where,
    include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
    orderBy: { date: 'desc' },
  })
  res.json(attendance)
}

export const createAttendance = async (req, res) => {
  const tp = await prisma.teacherProfile.findUnique({ where: { userId: req.user.sub } })
  const { records, courseId, date } = req.body
  // records: [{ studentId, status, comment }]
  const created = await prisma.$transaction(
    records.map(r => prisma.attendance.create({
      data: { ...r, courseId, date: new Date(date), teacherId: tp?.id },
    }))
  )
  res.status(201).json(created)
}
