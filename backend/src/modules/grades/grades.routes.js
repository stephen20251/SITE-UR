import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.js'
import { requirePermission } from '../../middlewares/rbac.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import * as svc from './grades.service.js'

const r = Router()
r.use(authenticate)

r.get('/',                         asyncHandler(svc.listGrades))
r.post('/',                        asyncHandler(svc.createGrade))
r.put('/:id',                      asyncHandler(svc.updateGrade))
r.delete('/:id',                   asyncHandler(svc.deleteGrade))
r.put('/:id/validate',             asyncHandler(svc.validateGrade))
r.get('/bulletin/:studentId/:semesterId', asyncHandler(svc.getBulletin))
r.get('/classlist',                asyncHandler(svc.getClassGrades))
r.post('/bulk',                    asyncHandler(svc.bulkUpsertGrades))
r.get('/averages',                 asyncHandler(svc.getSemesterAverages))
r.get('/attendance',               asyncHandler(svc.listAttendance))
r.post('/attendance',              asyncHandler(svc.createAttendance))

export default r
