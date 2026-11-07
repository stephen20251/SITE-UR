import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.js'
import { requirePermission } from '../../middlewares/rbac.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import * as svc from './structure.service.js'

const r = Router()
r.use(authenticate)

// Campus
r.get('/campuses',                   asyncHandler(svc.listCampuses))
r.post('/campuses',                  requirePermission('MANAGE_CAMPUS'), asyncHandler(svc.createCampus))
r.put('/campuses/:id',               requirePermission('MANAGE_CAMPUS'), asyncHandler(svc.updateCampus))

// Faculty
r.get('/faculties',                  asyncHandler(svc.listFaculties))
r.post('/faculties',                 requirePermission('MANAGE_FACULTY'), asyncHandler(svc.createFaculty))
r.put('/faculties/:id',              requirePermission('MANAGE_FACULTY'), asyncHandler(svc.updateFaculty))

// Department
r.get('/departments',                asyncHandler(svc.listDepartments))
r.post('/departments',               requirePermission('MANAGE_DEPARTMENT'), asyncHandler(svc.createDepartment))
r.put('/departments/:id',            requirePermission('MANAGE_DEPARTMENT'), asyncHandler(svc.updateDepartment))

// Mention
r.get('/mentions',                   asyncHandler(svc.listMentions))
r.post('/mentions',                  requirePermission('MANAGE_MENTION'), asyncHandler(svc.createMention))
r.put('/mentions/:id',               requirePermission('MANAGE_MENTION'), asyncHandler(svc.updateMention))
r.delete('/mentions/:id',            requirePermission('MANAGE_MENTION'), asyncHandler(svc.deleteMention))

// Parcours
r.get('/parcours',                   asyncHandler(svc.listParcours))
r.post('/parcours',                  requirePermission('MANAGE_MENTION'), asyncHandler(svc.createParcours))

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
