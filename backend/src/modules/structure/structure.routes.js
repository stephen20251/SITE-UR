import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import multer from 'multer'
import { authenticate } from '../../middlewares/auth.js'
import { requirePermission } from '../../middlewares/rbac.js'
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js'
import { prisma } from '../../database/prisma.js'
import { uploadsPath, fileFromUploadUrl } from '../../config/paths.js'
import * as svc from './structure.service.js'

const r = Router()

// Photo d'une mention (fenêtre de détail de l'accueil)
const MENTION_DIR = uploadsPath('mentions')
const mentionUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { fs.mkdirSync(MENTION_DIR, { recursive: true }); cb(null, MENTION_DIR) },
    filename: (req, file, cb) => cb(null, `${req.params.id}-${Date.now()}${path.extname(file.originalname).toLowerCase() || '.jpg'}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true)
    else cb(new HttpError(400, 'Image JPEG, PNG ou WebP uniquement'))
  },
})
const removeMentionImage = (url) => {
  if (url?.startsWith('/uploads/mentions/')) fs.unlink(fileFromUploadUrl(url) ?? '', () => {})
}
async function findMention(id) {
  const m = await prisma.mention.findUnique({ where: { id } })
  if (!m) throw new HttpError(404, 'Mention introuvable')
  return m
}
r.use(authenticate)

// Campus
r.get('/campuses',                   asyncHandler(svc.listCampuses))
r.post('/campuses',                  requirePermission('MANAGE_CAMPUS'), asyncHandler(svc.createCampus))
r.put('/campuses/:id',               requirePermission('MANAGE_CAMPUS'), asyncHandler(svc.updateCampus))

// Faculty
r.get('/faculties',                  asyncHandler(svc.listFaculties))
r.post('/faculties',                 requirePermission('MANAGE_FACULTY'), asyncHandler(svc.createFaculty))
r.put('/faculties/:id',              requirePermission('MANAGE_FACULTY'), asyncHandler(svc.updateFaculty))
r.delete('/faculties/:id',           requirePermission('MANAGE_FACULTY'), asyncHandler(svc.deleteFaculty))

// Department
r.get('/departments',                asyncHandler(svc.listDepartments))
r.post('/departments',               requirePermission('MANAGE_DEPARTMENT'), asyncHandler(svc.createDepartment))
r.put('/departments/:id',            requirePermission('MANAGE_DEPARTMENT'), asyncHandler(svc.updateDepartment))
r.delete('/departments/:id',         requirePermission('MANAGE_DEPARTMENT'), asyncHandler(svc.deleteDepartment))

// Mention
r.get('/mentions',                   asyncHandler(svc.listMentions))
r.post('/mentions',                  requirePermission('MANAGE_MENTION'), asyncHandler(svc.createMention))
r.put('/mentions/:id',               requirePermission('MANAGE_MENTION'), asyncHandler(svc.updateMention))
r.delete('/mentions/:id',            requirePermission('MANAGE_MENTION'), asyncHandler(svc.deleteMention))
r.post('/mentions/:id/image', requirePermission('MANAGE_MENTION'), asyncHandler(async (req, res, next) => {
  await findMention(req.params.id)
  next()
}), mentionUpload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Aucune image fournie')
  const current = await findMention(req.params.id)
  removeMentionImage(current.imageUrl)
  res.json(await prisma.mention.update({ where: { id: current.id }, data: { imageUrl: `/uploads/mentions/${req.file.filename}` } }))
}))
r.delete('/mentions/:id/image', requirePermission('MANAGE_MENTION'), asyncHandler(async (req, res) => {
  const current = await findMention(req.params.id)
  removeMentionImage(current.imageUrl)
  res.json(await prisma.mention.update({ where: { id: current.id }, data: { imageUrl: null } }))
}))

// Parcours
r.get('/parcours',                   asyncHandler(svc.listParcours))
r.post('/parcours',                  requirePermission('MANAGE_MENTION'), asyncHandler(svc.createParcours))
r.put('/parcours/:id',               requirePermission('MANAGE_MENTION'), asyncHandler(svc.updateParcours))
r.delete('/parcours/:id',            requirePermission('MANAGE_MENTION'), asyncHandler(svc.deleteParcours))

// Academic Year
r.get('/academic-years',             asyncHandler(svc.listAcademicYears))
r.post('/academic-years',            requirePermission('MANAGE_ACADEMIC_YEAR'), asyncHandler(svc.createAcademicYear))
r.put('/academic-years/:id/current', requirePermission('MANAGE_ACADEMIC_YEAR'), asyncHandler(svc.setCurrentYear))
r.post('/academic-years/:id/activate', requirePermission('MANAGE_ACADEMIC_YEAR'), asyncHandler(svc.activateAcademicYear))
r.post('/academic-years/:id/close',    requirePermission('MANAGE_ACADEMIC_YEAR'), asyncHandler(svc.closeAcademicYear))
r.post('/academic-years/:id/archive',  requirePermission('MANAGE_ACADEMIC_YEAR'), asyncHandler(svc.closeAcademicYear))
r.get('/academic-years/:id/semesters', asyncHandler(svc.listSemestersByYear))

// Semester
r.get('/semesters',                  asyncHandler(svc.listSemesters))
r.post('/semesters',                 requirePermission('MANAGE_SEMESTER'), asyncHandler(svc.createSemester))
r.put('/semesters/:id/active',       requirePermission('MANAGE_SEMESTER'), asyncHandler(svc.setActiveSemester))

// Rooms
r.get('/rooms',                      asyncHandler(svc.listRooms))
r.post('/rooms',                     requirePermission('MANAGE_ROOM'), asyncHandler(svc.createRoom))
r.put('/rooms/:id',                  requirePermission('MANAGE_ROOM'), asyncHandler(svc.updateRoom))

// Promotions
r.get('/promotions',                 asyncHandler(svc.listPromotions))
r.post('/promotions',                requirePermission('MANAGE_PROMOTION'), asyncHandler(svc.createPromotion))
r.put('/promotions/:id',             requirePermission('MANAGE_PROMOTION'), asyncHandler(svc.updatePromotion))

// Groups
r.get('/promotions/:promotionId/groups', asyncHandler(svc.listGroups))
r.post('/groups',                    requirePermission('MANAGE_PROMOTION'), asyncHandler(svc.createGroup))

// Subjects
r.get('/subjects',                   asyncHandler(svc.listSubjects))
r.post('/subjects',                  requirePermission('CREATE_SUBJECT'), asyncHandler(svc.createSubject))
r.put('/subjects/:id',               requirePermission('CREATE_SUBJECT'), asyncHandler(svc.updateSubject))

// Teaching Units
r.get('/teaching-units',             asyncHandler(svc.listTeachingUnits))
r.post('/teaching-units',            requirePermission('CREATE_SUBJECT'), asyncHandler(svc.createTeachingUnit))

export default r
