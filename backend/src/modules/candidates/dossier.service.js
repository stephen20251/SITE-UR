// Dossier de candidature et d'inscription — parcours pour devenir étudiant de l'UR :
//
//  1. Pré-inscription (statut DRAFT / REJECTED) — le candidat fournit :
//       CIN ou copie d'acte de naissance, photo 4x4, diplôme / relevé / attestation
//       de réussite au BACC, et répond au questionnaire de motivation.
//  2. Examen du dossier par le secrétariat (SUBMITTED → UNDER_REVIEW → ACCEPTED / REJECTED),
//     pièce par pièce (vérifiée / refusée avec commentaire).
//  3. Inscription (statut ACCEPTED) — le candidat remplit la fiche d'inscription,
//     dépose la lettre d'engagement parental, la référence de paiement du droit
//     d'inscription et, s'il vient d'une autre école, la demande d'admission et
//     le relevé de notes. Il soumet son dossier d'inscription.
//  4. Validation de l'inscription par le secrétariat → ENROLLED (compte étudiant).
//
// Les pièces sont stockées hors du dossier public /uploads et servies uniquement
// au candidat lui-même et au personnel habilité.
import fs from 'fs'
import path from 'path'
import { prisma } from '../../database/prisma.js'
import { HttpError } from '../../utils/asyncHandler.js'
import { loadStaffContext } from '../../middlewares/rbac.js'

export const PRIVATE_DIR = path.resolve('private-uploads', 'candidates')

export const DOC_TYPES = {
  // Pré-inscription
  CIN_OR_BIRTH: { stage: 'PRE_INSCRIPTION', label: "CIN ou copie d'acte de naissance", required: true },
  PHOTO: { stage: 'PRE_INSCRIPTION', label: 'Photo d\'identité 4x4', required: true },
  BACC: { stage: 'PRE_INSCRIPTION', label: 'Diplôme, relevé ou attestation de réussite au BACC', required: true },
  // Inscription
  ENGAGEMENT_PARENTAL: { stage: 'INSCRIPTION', label: "Lettre d'engagement parental", required: true },
  PAYMENT_PROOF: { stage: 'INSCRIPTION', label: "Justificatif de paiement du droit d'inscription", required: false },
  DEMANDE_ADMISSION: { stage: 'INSCRIPTION', label: "Demande d'admission adressée au service des admissions", otherSchool: true },
  RELEVE_NOTES: { stage: 'INSCRIPTION', label: 'Relevé des notes', otherSchool: true },
}

// Questionnaire de motivation (pré-inscription)
export const MOTIVATION_QUESTIONS = [
  { key: 'why', label: "Pourquoi souhaitez-vous intégrer l'University Reference ?" },
  { key: 'project', label: 'Quel est votre projet professionnel ?' },
  { key: 'mention', label: 'Pourquoi avez-vous choisi cette mention ?' },
  { key: 'strengths', label: 'Quels sont vos points forts pour réussir dans cette formation ?' },
  { key: 'source', label: 'Comment avez-vous connu l\'université ?' },
]

// Champs obligatoires de la fiche d'inscription
export const REQUIRED_FORM_FIELDS = [
  ['lastName', 'Nom'], ['firstNames', 'Prénoms'], ['nationality', 'Nationalité'], ['sex', 'Sexe'],
  ['address', 'Adresse complète'], ['birthDate', 'Date de naissance'], ['birthPlace', 'Lieu de naissance'],
  ['maritalStatus', 'Statut matrimonial'], ['baccYear', 'Année du BACC'], ['baccSerie', 'Série du BACC'],
  ['parcours', 'Parcours souhaité'], ['personalStatement', 'Déclaration personnelle'],
]

const PRE_EDITABLE = ['DRAFT', 'REJECTED']

async function myCandidate(userId) {
  const c = await prisma.candidate.findUnique({ where: { userId } })
  if (!c) throw new HttpError(404, 'Candidature non trouvée')
  return c
}

function stageEditable(c, stage) {
  if (stage === 'PRE_INSCRIPTION') return PRE_EDITABLE.includes(c.status)
  return c.status === 'ACCEPTED' && !c.inscriptionSubmittedAt
}

// ── Pièces jointes ──────────────────────────────────────────────────────────
export async function uploadDocument(userId, file, type) {
  if (!file) throw new HttpError(400, 'Fichier manquant')
  const def = DOC_TYPES[type]
  if (!def) { fs.unlink(file.path, () => {}); throw new HttpError(400, 'Type de pièce inconnu') }
  const c = await myCandidate(userId)
  // Une pièce refusée par le secrétariat peut toujours être renvoyée (tant que le candidat n'est pas inscrit)
  const rejected = c.status !== 'ENROLLED' && !!(await prisma.candidateDocument.findFirst({
    where: { candidateId: c.id, type, reviewStatus: 'REJECTED' },
  }))
  if (!stageEditable(c, def.stage) && !rejected) {
    fs.unlink(file.path, () => {})
    throw new HttpError(400, def.stage === 'PRE_INSCRIPTION'
      ? 'Dossier de pré-inscription déjà soumis'
      : "Le dossier d'inscription n'est pas modifiable (candidature non acceptée ou déjà soumise)")
  }
  // Une seule pièce par type : on remplace l'ancienne
  const old = await prisma.candidateDocument.findMany({ where: { candidateId: c.id, type } })
  for (const d of old) {
    fs.unlink(path.join(PRIVATE_DIR, path.basename(d.url)), () => {})
    await prisma.candidateDocument.delete({ where: { id: d.id } })
  }
  return prisma.candidateDocument.create({
    data: {
      candidateId: c.id, type, stage: def.stage, name: file.originalname,
      url: path.basename(file.path), mimeType: file.mimetype,
    },
  })
}

export async function deleteDocument(userId, docId) {
  const c = await myCandidate(userId)
  const d = await prisma.candidateDocument.findUnique({ where: { id: docId } })
  if (!d || d.candidateId !== c.id) throw new HttpError(404, 'Pièce introuvable')
  if (!stageEditable(c, d.stage)) throw new HttpError(400, 'Cette pièce ne peut plus être retirée')
  fs.unlink(path.join(PRIVATE_DIR, path.basename(d.url)), () => {})
  await prisma.candidateDocument.delete({ where: { id: docId } })
}

// Fichier d'une pièce : le candidat propriétaire ou le personnel des admissions
// Bloque une étape tant qu'une pièce de ce stade est refusée
export async function assertNoRejectedDocs(candidateId, stage) {
  const bad = await prisma.candidateDocument.findMany({ where: { candidateId, stage, reviewStatus: 'REJECTED' }, select: { type: true, name: true } })
  if (bad.length) {
    throw new HttpError(400, `Pièce(s) refusée(s) en attente de correction : ${bad.map((d) => DOC_TYPES[d.type]?.label ?? d.name).join(', ')}`)
  }
}

export async function documentFile(req, docId) {
  const d = await prisma.candidateDocument.findUnique({ where: { id: docId }, include: { candidate: { select: { userId: true } } } })
  if (!d) throw new HttpError(404, 'Pièce introuvable')
  if (d.candidate.userId !== req.user.sub) {
    const staff = await loadStaffContext(req)
    if (!staff.has('VIEW_CANDIDATES')) throw new HttpError(403, 'Accès refusé')
  }
  const file = path.join(PRIVATE_DIR, path.basename(d.url))
  if (!fs.existsSync(file)) throw new HttpError(404, 'Fichier introuvable sur le serveur')
  return { file, name: d.name, mimeType: d.mimeType }
}

// ── Pré-inscription ─────────────────────────────────────────────────────────
export async function saveMotivation(userId, answers) {
  const c = await myCandidate(userId)
  if (!PRE_EDITABLE.includes(c.status)) throw new HttpError(400, 'Dossier déjà soumis')
  const clean = {}
  for (const q of MOTIVATION_QUESTIONS) clean[q.key] = String(answers?.[q.key] ?? '').slice(0, 3000)
  return prisma.candidate.update({ where: { id: c.id }, data: { motivation: clean } })
}

export async function assertPreInscriptionComplete(c) {
  const docs = await prisma.candidateDocument.findMany({ where: { candidateId: c.id }, select: { type: true } })
  const have = new Set(docs.map((d) => d.type))
  const missing = Object.entries(DOC_TYPES)
    .filter(([k, v]) => v.stage === 'PRE_INSCRIPTION' && v.required && !have.has(k))
    .map(([, v]) => v.label)
  const m = c.motivation ?? {}
  const unanswered = MOTIVATION_QUESTIONS.filter((q) => q.key !== 'source' && !(m[q.key] ?? '').trim())
  if (missing.length || unanswered.length) {
    const parts = []
    if (missing.length) parts.push(`pièces manquantes : ${missing.join(', ')}`)
    if (unanswered.length) parts.push('questionnaire de motivation incomplet')
    throw new HttpError(400, `Dossier incomplet — ${parts.join(' ; ')}`)
  }
}

// ── Inscription (après acceptation) ─────────────────────────────────────────
export async function saveInscription(userId, { form, paymentReference, fromOtherSchool }) {
  const c = await myCandidate(userId)
  if (!stageEditable(c, 'INSCRIPTION')) throw new HttpError(400, "Le dossier d'inscription n'est pas modifiable")
  return prisma.candidate.update({
    where: { id: c.id },
    data: {
      ...(form !== undefined && { inscriptionForm: form }),
      ...(paymentReference !== undefined && { paymentReference: paymentReference?.trim() || null }),
      ...(fromOtherSchool !== undefined && { fromOtherSchool: !!fromOtherSchool }),
    },
  })
}

export async function submitInscription(userId) {
  const c = await myCandidate(userId)
  if (!stageEditable(c, 'INSCRIPTION')) throw new HttpError(400, "Le dossier d'inscription n'est pas modifiable")
  const form = c.inscriptionForm ?? {}
  const problems = []
  const emptyFields = REQUIRED_FORM_FIELDS.filter(([k]) => !String(form[k] ?? '').trim()).map(([, l]) => l)
  if (emptyFields.length) problems.push(`fiche d'inscription incomplète (${emptyFields.join(', ')})`)
  if (!form.declarationAccepted) problems.push('déclaration du candidat non acceptée')
  if (!c.paymentReference) problems.push("référence de paiement du droit d'inscription manquante")
  const docs = await prisma.candidateDocument.findMany({ where: { candidateId: c.id }, select: { type: true } })
  const have = new Set(docs.map((d) => d.type))
  const needed = Object.entries(DOC_TYPES).filter(([, v]) => v.stage === 'INSCRIPTION' && (v.required || (v.otherSchool && c.fromOtherSchool)))
  const missing = needed.filter(([k]) => !have.has(k)).map(([, v]) => v.label)
  if (missing.length) problems.push(`pièces manquantes : ${missing.join(', ')}`)
  if (problems.length) throw new HttpError(400, `Dossier d'inscription incomplet — ${problems.join(' ; ')}`)

  const updated = await prisma.candidate.update({ where: { id: c.id }, data: { inscriptionSubmittedAt: new Date() } })
  // Prévenir le personnel des admissions
  const staff = await prisma.userRole.findMany({
    where: { role: { rolePermissions: { some: { permission: { code: 'ENROLL_STUDENT' } } } } },
    select: { userId: true },
  })
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } })
  const ids = [...new Set(staff.map((s) => s.userId))]
  if (ids.length) {
    await prisma.notification.createMany({
      data: ids.map((uid) => ({
        userId: uid, type: 'ADMISSION',
        title: "Dossier d'inscription à valider",
        body: `${user.firstName} ${user.lastName} a envoyé son dossier d'inscription.`,
        link: '/classroom/candidatures',
      })),
    })
  }
  return updated
}

// ── Secrétariat : analyse des pièces ────────────────────────────────────────
export async function reviewDocument(reviewerId, candidateId, docId, { status, note }) {
  if (!['VERIFIED', 'REJECTED', 'PENDING'].includes(status)) throw new HttpError(400, 'Statut invalide')
  if (status === 'REJECTED' && !note?.trim()) throw new HttpError(400, 'Indiquez au candidat pourquoi la pièce est refusée')
  const d = await prisma.candidateDocument.findUnique({ where: { id: docId }, include: { candidate: true } })
  if (!d || d.candidateId !== candidateId) throw new HttpError(404, 'Pièce introuvable')
  const updated = await prisma.candidateDocument.update({
    where: { id: docId },
    data: { reviewStatus: status, verified: status === 'VERIFIED', reviewNote: note?.trim() || null },
  })
  if (status === 'REJECTED') {
    await prisma.notification.create({
      data: {
        userId: d.candidate.userId, type: 'ADMISSION',
        title: `Pièce à corriger : ${DOC_TYPES[d.type]?.label ?? d.name}`,
        body: note.trim(),
        link: '/classroom/candidat',
      },
    })
  }
  return updated
}

// Le secrétariat renvoie le dossier d'inscription au candidat pour correction
export async function returnInscription(candidateId, reason) {
  const c = await prisma.candidate.findUnique({ where: { id: candidateId } })
  if (!c) throw new HttpError(404, 'Candidature non trouvée')
  if (c.status !== 'ACCEPTED' || !c.inscriptionSubmittedAt) throw new HttpError(400, "Aucun dossier d'inscription en attente")
  const updated = await prisma.candidate.update({ where: { id: candidateId }, data: { inscriptionSubmittedAt: null } })
  await prisma.notification.create({
    data: {
      userId: c.userId, type: 'ADMISSION',
      title: "Dossier d'inscription à compléter",
      body: reason?.trim() || 'Le secrétariat vous demande de compléter votre dossier d\'inscription.',
      link: '/classroom/candidat',
    },
  })
  return updated
}
