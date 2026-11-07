import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.js'
import { requirePermission } from '../../middlewares/rbac.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import * as svc from './candidates.service.js'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import * as dossier from './dossier.service.js'

fs.mkdirSync(dossier.PRIVATE_DIR, { recursive: true })
const upload = multer({
  storage: multer.diskStorage({
    destination: dossier.PRIVATE_DIR,
    filename: (req, file, cb) => cb(null, `${req.user.sub}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.mimetype)
    cb(ok ? null : new Error('Formats acceptés : PDF, image (JPG, PNG) ou Word'), ok)
  },
})

const r = Router()
r.use(authenticate)

r.get('/',                    requirePermission('VIEW_CANDIDATES'), asyncHandler(svc.listCandidates))
r.get('/my',                  asyncHandler(svc.myCandidature))

// ── Dossier : pièces, questionnaire, inscription ──────────────────────────────
r.get('/meta', (req, res) => res.json({
  docTypes: dossier.DOC_TYPES, questions: dossier.MOTIVATION_QUESTIONS, requiredFormFields: dossier.REQUIRED_FORM_FIELDS,
}))
r.post('/my/documents', upload.single('file'), asyncHandler(async (req, res) => {
  res.status(201).json(await dossier.uploadDocument(req.user.sub, req.file, req.body.type))
}))
r.delete('/my/documents/:docId', asyncHandler(async (req, res) => {
  await dossier.deleteDocument(req.user.sub, req.params.docId)
  res.status(204).end()
}))
r.put('/my/motivation', asyncHandler(async (req, res) => {
  res.json(await dossier.saveMotivation(req.user.sub, req.body.answers))
}))
r.put('/my/inscription', asyncHandler(async (req, res) => {
  res.json(await dossier.saveInscription(req.user.sub, req.body))
}))
r.post('/my/inscription/submit', asyncHandler(async (req, res) => {
  res.json(await dossier.submitInscription(req.user.sub))
}))
r.get('/documents/:docId/file', asyncHandler(async (req, res) => {
  const f = await dossier.documentFile(req, req.params.docId)
  if (f.mimeType) res.type(f.mimeType)
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(f.name)}"`)
  res.sendFile(f.file)
}))
r.put('/:id/documents/:docId/review', requirePermission('REVIEW_CANDIDATE'), asyncHandler(async (req, res) => {
  res.json(await dossier.reviewDocument(req.user.sub, req.params.id, req.params.docId, req.body))
}))
r.put('/:id/inscription/return', requirePermission('ENROLL_STUDENT'), asyncHandler(async (req, res) => {
  res.json(await dossier.returnInscription(req.params.id, req.body.reason))
}))
r.get('/:id',                 requirePermission('VIEW_CANDIDATES'), asyncHandler(svc.getCandidate))
r.put('/:id/review',          requirePermission('REVIEW_CANDIDATE'), asyncHandler(svc.reviewCandidate))
r.put('/:id/accept',          requirePermission('ACCEPT_CANDIDATE'), asyncHandler(svc.acceptCandidate))
r.put('/:id/reject',          requirePermission('ACCEPT_CANDIDATE'), asyncHandler(svc.rejectCandidate))
r.post('/:id/enroll',         requirePermission('ENROLL_STUDENT'), asyncHandler(svc.enrollStudent))
r.put('/my/mention',          asyncHandler(svc.chooseMention))
r.put('/my/submit',           asyncHandler(svc.submitCandidature))

export default r
