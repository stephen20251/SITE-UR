import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.js'
import { requirePermission } from '../../middlewares/rbac.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import * as svc from './courses.service.js'

const r = Router()
r.use(authenticate)

// Courses
r.get('/',                            requirePermission('VIEW_COURSES'), asyncHandler(svc.listCourses))
r.get('/:id',                         requirePermission('VIEW_COURSES'), asyncHandler(svc.getCourse))
r.post('/',                           requirePermission('CREATE_COURSE'), asyncHandler(svc.createCourse))
r.put('/:id',                         requirePermission('EDIT_COURSE'), asyncHandler(svc.updateCourse))
r.delete('/:id',                      requirePermission('DELETE_COURSE'), asyncHandler(svc.deleteCourse))
r.put('/:id/publish',                 requirePermission('PUBLISH_COURSE'), asyncHandler(svc.publishCourse))
r.put('/:id/approve',                 requirePermission('APPROVE_COURSE'), asyncHandler(svc.approveCourse))

// Teachers on course
r.post('/:id/teachers',               requirePermission('ASSIGN_TEACHER'), asyncHandler(svc.assignTeacher))
r.delete('/:id/teachers/:teacherId',  requirePermission('ASSIGN_TEACHER'), asyncHandler(svc.removeTeacher))

// Chapters
r.get('/:courseId/chapters',          asyncHandler(svc.listChapters))
r.post('/:courseId/chapters',         requirePermission('VIEW_COURSES'), asyncHandler(svc.createChapter))
r.put('/chapters/:id',                asyncHandler(svc.updateChapter))
r.delete('/chapters/:id',             asyncHandler(svc.deleteChapter))

// Resources
r.get('/chapters/:chapterId/resources',   asyncHandler(svc.listResources))
r.post('/chapters/:chapterId/resources',  asyncHandler(svc.createResource))
r.put('/resources/:id',                   asyncHandler(svc.updateResource))
r.delete('/resources/:id',                asyncHandler(svc.deleteResource))
r.post('/resources/:id/progress',         asyncHandler(svc.markProgress))

// Assignments
r.get('/:courseId/assignments',       asyncHandler(svc.listAssignments))
r.post('/:courseId/assignments',      requirePermission('CREATE_ASSIGNMENT'), asyncHandler(svc.createAssignment))
r.post('/assignments/:id/submit',     asyncHandler(svc.submitAssignment))
r.put('/assignments/:id/grade/:studentId', requirePermission('GRADE_SUBMISSION'), asyncHandler(svc.gradeSubmission))

export default r
