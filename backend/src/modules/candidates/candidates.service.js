import { prisma } from '../../database/prisma.js'
import { HttpError } from '../../utils/asyncHandler.js'
import { hashPassword } from '../../utils/hash.js'
import { generateMatricule } from '../inscriptions/inscriptions.service.js'
import { assertNoRejectedDocs, assertPreInscriptionComplete } from './dossier.service.js'

const CANDIDATE_INCLUDE = {
  user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, createdAt: true } },
  mention: { select: { id: true, name: true, code: true } },
  documents: { orderBy: { uploadedAt: 'asc' } },
}

export const listCandidates = async (req, res) => {
  const { status, mentionId, search, page = 1, limit = 20 } = req.query
  const where = {}
  if (status) where.status = status
  if (mentionId) where.mentionId = mentionId
  if (search) {
    where.user = { OR: [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]}
  }

  const [total, candidates] = await Promise.all([
    prisma.candidate.count({ where }),
    prisma.candidate.findMany({
      where, include: CANDIDATE_INCLUDE,
      skip: (Number(page) - 1) * Number(limit), take: Number(limit),
      orderBy: [{ submittedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    }),
  ])
  res.json({ total, candidates })
}

export const getCandidate = async (req, res) => {
  const c = await prisma.candidate.findUnique({ where: { id: req.params.id }, include: CANDIDATE_INCLUDE })
  if (!c) throw new HttpError(404, 'Candidature non trouvée')
  res.json(c)
}

export const myCandidature = async (req, res) => {
  const c = await prisma.candidate.findUnique({ where: { userId: req.user.sub }, include: CANDIDATE_INCLUDE })
  if (!c) throw new HttpError(404, 'Aucune candidature trouvée')
  res.json(c)
}

// Le candidat complète son dossier (mention, niveau, motivation) tant qu'il est en brouillon.
export const chooseMention = async (req, res) => {
  const current = await prisma.candidate.findUnique({ where: { userId: req.user.sub } })
  if (!current) throw new HttpError(404, 'Candidature non trouvée')
  if (!['DRAFT', 'REJECTED'].includes(current.status)) throw new HttpError(400, 'Dossier déjà soumis : il ne peut plus être modifié')
  const { mentionId, level, notes, phone } = req.body
  if (phone !== undefined) await prisma.user.update({ where: { id: req.user.sub }, data: { phone } })
  const c = await prisma.candidate.update({
    where: { userId: req.user.sub },
    data: {
      ...(mentionId !== undefined && { mentionId: mentionId || null }),
      ...(level !== undefined && { level }),
      ...(notes !== undefined && { notes }),
      // Un dossier refusé repasse en brouillon quand le candidat le corrige.
      ...(current.status === 'REJECTED' && { status: 'DRAFT', rejectionReason: null }),
    },
    include: CANDIDATE_INCLUDE,
  })
  res.json(c)
}

export const submitCandidature = async (req, res) => {
  const c = await prisma.candidate.findUnique({ where: { userId: req.user.sub } })
  if (!c) throw new HttpError(404, 'Candidature non trouvée')
  if (!['DRAFT', 'REJECTED'].includes(c.status)) throw new HttpError(400, 'Candidature déjà soumise')
  if (!c.mentionId) throw new HttpError(400, 'Choisissez une mention avant de soumettre')
  await assertPreInscriptionComplete(c)
  const updated = await prisma.candidate.update({
    where: { userId: req.user.sub },
    data: { status: 'SUBMITTED', submittedAt: new Date(), rejectionReason: null },
  })
  res.json(updated)
}

export const reviewCandidate = async (req, res) => {
  const c = await prisma.candidate.update({
    where: { id: req.params.id },
    data: { status: 'UNDER_REVIEW', reviewedAt: new Date(), reviewedBy: req.user.sub },
  })
  res.json(c)
}

export const acceptCandidate = async (req, res) => {
  await assertNoRejectedDocs(req.params.id, 'PRE_INSCRIPTION')
  const c = await prisma.candidate.update({
    where: { id: req.params.id },
    data: { status: 'ACCEPTED', reviewedAt: new Date(), reviewedBy: req.user.sub },
  })
  await prisma.notification.create({
    data: {
      userId: c.userId, type: 'ADMISSION',
      title: 'Candidature acceptée !',
      body: "Félicitations ! Votre candidature a été acceptée. Complétez maintenant votre dossier d'inscription : fiche d'inscription, lettre d'engagement parental et référence de paiement du droit d'inscription.",
      link: '/classroom/candidat',
    },
  })
  res.json(c)
}

export const rejectCandidate = async (req, res) => {
  const c = await prisma.candidate.update({
    where: { id: req.params.id },
    data: {
      status: 'REJECTED', reviewedAt: new Date(), reviewedBy: req.user.sub,
      rejectionReason: req.body.reason,
    },
  })
  await prisma.notification.create({
    data: {
      userId: c.userId, type: 'ADMISSION',
      title: 'Candidature non retenue',
      body: req.body.reason ?? 'Votre candidature n\'a pas été retenue cette année.',
    },
  })
  res.json(c)
}

export const enrollStudent = async (req, res) => {
  const candidate = await prisma.candidate.findUnique({
    where: { id: req.params.id }, include: { user: true },
  })
  if (!candidate) throw new HttpError(404, 'Candidature non trouvée')
  if (candidate.status !== 'ACCEPTED') throw new HttpError(400, 'Le candidat doit être accepté avant inscription')
  await assertNoRejectedDocs(candidate.id, 'INSCRIPTION')
  if (!candidate.inscriptionSubmittedAt) {
    throw new HttpError(400, "Le candidat n'a pas encore envoyé son dossier d'inscription (fiche, engagement parental, paiement)")
  }

  const { promotionId, groupId, studyMode } = req.body
  if (!promotionId) throw new HttpError(400, 'Choisissez la promotion d\'accueil')
  if (studyMode !== undefined && !['PRESENTIEL', 'EN_LIGNE'].includes(studyMode)) {
    throw new HttpError(400, 'Mode d\'étude invalide (PRESENTIEL ou EN_LIGNE)')
  }
  const promo = await prisma.promotion.findUnique({
    where: { id: promotionId },
    include: { mention: true, academicYear: true },
  })
  if (!promo) throw new HttpError(404, 'Promotion introuvable')
  const mentionId = promo.mentionId
  const matricule = await generateMatricule(promo.mention.code, promo.academicYear?.label)

  const [studentProfile] = await prisma.$transaction([
    prisma.studentProfile.create({
      data: {
        userId: candidate.userId, matricule, promotionId, groupId: groupId || null,
        mentionId,
        status: 'ACTIVE', enrollmentDate: new Date(),
        ...(studyMode && { studyMode }),
      },
    }),
    prisma.user.update({ where: { id: candidate.userId }, data: { systemRole: 'STUDENT' } }),
    prisma.candidate.update({ where: { id: req.params.id }, data: { status: 'ENROLLED' } }),
  ])

  await prisma.notification.create({
    data: {
      userId: candidate.userId, type: 'ADMISSION',
      title: 'Inscription confirmée',
      body: `Bienvenue ! Votre matricule est : ${matricule}. Reconnectez-vous pour accéder à votre espace étudiant.`,
    },
  })

  res.status(201).json(studentProfile)
}
