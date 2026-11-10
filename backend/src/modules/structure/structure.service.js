import { prisma } from '../../database/prisma.js'
import { HttpError } from '../../utils/asyncHandler.js'

// ── Campus ───────────────────────────────────────────────────────
export const listCampuses = async (req, res) => {
  const data = await prisma.campus.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
  res.json(data)
}
export const createCampus = async (req, res) => {
  const campus = await prisma.campus.create({ data: req.body })
  res.status(201).json(campus)
}
export const updateCampus = async (req, res) => {
  const campus = await prisma.campus.update({ where: { id: req.params.id }, data: req.body })
  res.json(campus)
}

// ── Faculty ───────────────────────────────────────────────────────
export const listFaculties = async (req, res) => {
  const data = await prisma.faculty.findMany({
    where: req.query.campusId ? { campusId: req.query.campusId, isActive: true } : { isActive: true },
    include: { campus: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  })
  res.json(data)
}
export const createFaculty = async (req, res) => {
  const faculty = await prisma.faculty.create({ data: req.body })
  res.status(201).json(faculty)
}
export const updateFaculty = async (req, res) => {
  const faculty = await prisma.faculty.update({ where: { id: req.params.id }, data: req.body })
  res.json(faculty)
}

// ── Department ────────────────────────────────────────────────────
export const listDepartments = async (req, res) => {
  const data = await prisma.department.findMany({
    where: req.query.facultyId ? { facultyId: req.query.facultyId, isActive: true } : { isActive: true },
    include: { faculty: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  })
  res.json(data)
}
export const createDepartment = async (req, res) => {
  const dept = await prisma.department.create({ data: req.body })
  res.status(201).json(dept)
}
export const updateDepartment = async (req, res) => {
  const dept = await prisma.department.update({ where: { id: req.params.id }, data: req.body })
  res.json(dept)
}

// ── Mention ───────────────────────────────────────────────────────
export const listMentions = async (req, res) => {
  const data = await prisma.mention.findMany({
    where: req.query.departmentId ? { departmentId: req.query.departmentId, isActive: true } : { isActive: true },
    include: { department: { include: { faculty: { include: { campus: true } } } } },
    orderBy: { name: 'asc' },
  })
  res.json(data)
}
// Champs modifiables d'une mention, dont sa présentation publique (fenêtre de détail de l'accueil).
const MENTION_TEXT_FIELDS = ['name', 'code', 'level', 'description', 'tagline', 'diploma', 'studyModes', 'objectives', 'skills', 'careers', 'admission']
function mentionInput(b = {}, { create = false } = {}) {
  const data = {}
  for (const k of MENTION_TEXT_FIELDS) {
    if (b[k] === undefined) continue
    const v = b[k] === null ? null : String(b[k]).trim().slice(0, 8000)
    data[k] = v || null
  }
  if (b.duration !== undefined) {
    const n = Number(b.duration)
    if (!Number.isInteger(n) || n < 1 || n > 10) throw new HttpError(400, 'Durée invalide (1 à 10 ans)')
    data.duration = n
  }
  if (b.departmentId !== undefined) data.departmentId = String(b.departmentId)
  if (b.isActive !== undefined) data.isActive = Boolean(b.isActive)
  if ('name' in data && !data.name) throw new HttpError(400, 'Le nom de la mention est obligatoire')
  if ('code' in data && !data.code) throw new HttpError(400, 'Le code de la mention est obligatoire')
  if (create && (!data.name || !data.code || !data.departmentId)) throw new HttpError(400, 'Nom, code et département sont obligatoires')
  return data
}
export const createMention = async (req, res) => {
  const mention = await prisma.mention.create({ data: mentionInput(req.body, { create: true }) })
  res.status(201).json(mention)
}
export const updateMention = async (req, res) => {
  const mention = await prisma.mention.update({ where: { id: req.params.id }, data: mentionInput(req.body) })
  res.json(mention)
}
export const deleteMention = async (req, res) => {
  await prisma.mention.update({ where: { id: req.params.id }, data: { isActive: false } })
  res.json({ ok: true })
}

// ── Parcours ──────────────────────────────────────────────────────
export const listParcours = async (req, res) => {
  const data = await prisma.parcours.findMany({
    where: req.query.mentionId ? { mentionId: req.query.mentionId, isActive: true } : { isActive: true },
    include: { mention: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  })
  res.json(data)
}
export const createParcours = async (req, res) => {
  const p = await prisma.parcours.create({ data: req.body })
  res.status(201).json(p)
}

// ── Academic Year ─────────────────────────────────────────────────
export const listAcademicYears = async (req, res) => {
  const where = req.query.campusId ? { campusId: req.query.campusId } : {};
  const data = await prisma.academicYear.findMany({
    where,
    include: {
      semesters: { orderBy: { number: 'asc' } },
      _count: { select: { promotions: true } },
    },
    orderBy: { startDate: 'desc' },
  });

  // Count active students per year (via their promotion's academicYearId)
  const yearIds = data.map(y => y.id);
  const grouped = await prisma.studentProfile.groupBy({
    by: ['promotionId'],
    where: { status: 'ACTIVE', promotion: { academicYearId: { in: yearIds } } },
    _count: { id: true },
  });
  // Resolve promotionId → academicYearId
  const promoYearMap = {};
  if (grouped.length) {
    const promos = await prisma.promotion.findMany({
      where: { id: { in: grouped.map(g => g.promotionId) } },
      select: { id: true, academicYearId: true },
    });
    promos.forEach(p => { promoYearMap[p.id] = p.academicYearId; });
  }
  const studentCountByYear = {};
  grouped.forEach(g => {
    const yid = promoYearMap[g.promotionId];
    if (yid) studentCountByYear[yid] = (studentCountByYear[yid] ?? 0) + g._count.id;
  });

  const result = data.map(y => ({
    ...y,
    _studentCount: studentCountByYear[y.id] ?? 0,
  }));
  res.json(result);
}
// Création d'une année universitaire : dates converties, campus par défaut,
// semestres S1 / S2 créés automatiquement (moitié de l'année chacun).
export const createAcademicYear = async (req, res) => {
  const { label, startDate, endDate } = req.body ?? {}
  if (!label?.trim()) throw new HttpError(400, "Le libellé de l'année est requis (ex : 2025-2026)")
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (isNaN(start) || isNaN(end)) throw new HttpError(400, 'Dates de début et de fin requises')
  if (end <= start) throw new HttpError(400, 'La date de fin doit être après la date de début')
  const campusId = req.body.campusId || (await prisma.campus.findFirst({ select: { id: true } }))?.id
  if (!campusId) throw new HttpError(400, "Aucun campus configuré : créez d'abord l'université dans Configuration")
  const dup = await prisma.academicYear.findFirst({ where: { campusId, label: label.trim() } })
  if (dup) throw new HttpError(409, `L'année ${label.trim()} existe déjà`)

  const mid = new Date(start.getTime() + (end - start) / 2)
  const year = await prisma.academicYear.create({
    data: {
      label: label.trim(), startDate: start, endDate: end, campusId,
      semesters: {
        create: [
          { name: 'S1', number: 1, startDate: start, endDate: mid },
          { name: 'S2', number: 2, startDate: new Date(mid.getTime() + 86_400_000), endDate: end },
        ],
      },
    },
    include: { semesters: true },
  })
  res.status(201).json(year)
}

// Activer : devient l'année en cours (les autres années du campus ne le sont plus)
export const activateAcademicYear = async (req, res) => {
  const y = await prisma.academicYear.findUnique({ where: { id: req.params.id } })
  if (!y) throw new HttpError(404, 'Année introuvable')
  await prisma.academicYear.updateMany({ where: { campusId: y.campusId }, data: { isCurrent: false } })
  res.json(await prisma.academicYear.update({ where: { id: y.id }, data: { isCurrent: true } }))
}

// Clôturer / archiver : l'année n'est plus en cours et se termine au plus tard aujourd'hui
export const closeAcademicYear = async (req, res) => {
  const y = await prisma.academicYear.findUnique({ where: { id: req.params.id } })
  if (!y) throw new HttpError(404, 'Année introuvable')
  const now = new Date()
  await prisma.semester.updateMany({ where: { academicYearId: y.id }, data: { isActive: false } })
  res.json(await prisma.academicYear.update({
    where: { id: y.id },
    data: { isCurrent: false, ...(y.endDate > now && { endDate: now }) },
  }))
}
export const setCurrentYear = async (req, res) => {
  await prisma.academicYear.updateMany({ where: { campusId: req.body.campusId }, data: { isCurrent: false } })
  const year = await prisma.academicYear.update({ where: { id: req.params.id }, data: { isCurrent: true } })
  res.json(year)
}

// ── Semester ──────────────────────────────────────────────────────
export const listSemesters = async (req, res) => {
  const data = await prisma.semester.findMany({
    where: req.query.academicYearId ? { academicYearId: req.query.academicYearId } : {},
    include: { academicYear: { select: { id: true, label: true } } },
    orderBy: { number: 'asc' },
  })
  res.json(data)
}
export const listSemestersByYear = async (req, res) => {
  const data = await prisma.semester.findMany({
    where: { academicYearId: req.params.id },
    orderBy: { number: 'asc' },
  })
  res.json(data)
}
export const createSemester = async (req, res) => {
  const sem = await prisma.semester.create({ data: req.body })
  res.status(201).json(sem)
}
export const setActiveSemester = async (req, res) => {
  await prisma.semester.updateMany({ data: { isActive: false } })
  const sem = await prisma.semester.update({ where: { id: req.params.id }, data: { isActive: true } })
  res.json(sem)
}

// ── Rooms ─────────────────────────────────────────────────────────
export const listRooms = async (req, res) => {
  const data = await prisma.room.findMany({
    where: req.query.campusId ? { campusId: req.query.campusId, isActive: true } : { isActive: true },
    orderBy: { name: 'asc' },
  })
  res.json(data)
}
export const createRoom = async (req, res) => {
  const room = await prisma.room.create({ data: req.body })
  res.status(201).json(room)
}
export const updateRoom = async (req, res) => {
  const room = await prisma.room.update({ where: { id: req.params.id }, data: req.body })
  res.json(room)
}

// ── Promotions ────────────────────────────────────────────────────
export const listPromotions = async (req, res) => {
  const where = {}
  if (req.query.mentionId) where.mentionId = req.query.mentionId
  if (req.query.academicYearId) where.academicYearId = req.query.academicYearId
  const data = await prisma.promotion.findMany({
    where,
    include: {
      mention: { select: { id: true, name: true, code: true } },
      academicYear: { select: { id: true, label: true } },
      parcours: { select: { id: true, name: true } },
      _count: { select: { students: true } },
    },
    orderBy: { name: 'asc' },
  })
  res.json(data)
}
export const createPromotion = async (req, res) => {
  const p = await prisma.promotion.create({ data: req.body })
  res.status(201).json(p)
}
export const updatePromotion = async (req, res) => {
  const p = await prisma.promotion.update({ where: { id: req.params.id }, data: req.body })
  res.json(p)
}

// ── Groups ────────────────────────────────────────────────────────
export const listGroups = async (req, res) => {
  const data = await prisma.group.findMany({
    where: { promotionId: req.params.promotionId },
    include: { _count: { select: { students: true } } },
    orderBy: { name: 'asc' },
  })
  res.json(data)
}
export const createGroup = async (req, res) => {
  const g = await prisma.group.create({ data: req.body })
  res.status(201).json(g)
}

// ── Subjects ──────────────────────────────────────────────────────
export const listSubjects = async (req, res) => {
  const where = req.query.mentionId ? { mentionId: req.query.mentionId, isActive: true } : { isActive: true }
  const data = await prisma.subject.findMany({
    where,
    include: { mention: { select: { id: true, name: true } }, teachingUnit: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  })
  res.json(data)
}
export const createSubject = async (req, res) => {
  const s = await prisma.subject.create({ data: req.body })
  res.status(201).json(s)
}
export const updateSubject = async (req, res) => {
  const s = await prisma.subject.update({ where: { id: req.params.id }, data: req.body })
  res.json(s)
}

// ── Teaching Units ────────────────────────────────────────────────
export const listTeachingUnits = async (req, res) => {
  const where = {}
  if (req.query.semesterId) where.semesterId = req.query.semesterId
  if (req.query.mentionId) where.mentionId = req.query.mentionId
  const data = await prisma.teachingUnit.findMany({ where, include: { subjects: true }, orderBy: { name: 'asc' } })
  res.json(data)
}
export const createTeachingUnit = async (req, res) => {
  const u = await prisma.teachingUnit.create({ data: req.body })
  res.status(201).json(u)
}
