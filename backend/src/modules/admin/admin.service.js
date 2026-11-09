import { prisma } from '../../database/prisma.js'
import { HttpError } from '../../utils/asyncHandler.js'
import { hashPassword } from '../../utils/hash.js'
import { generateTempPassword } from '../../utils/password.js'
import { ensureProfile } from '../me/ensure-profile.js'
import { sendAccountCreatedEmail, sendPasswordResetByAdminEmail } from '../../utils/account-emails.js'

const SYSTEM_ROLES = ['SUPER_ADMIN', 'STAFF', 'TEACHER', 'STUDENT', 'PARENT', 'CANDIDATE', 'STUDENT_ONLINE', 'TEACHER_ONLINE']
const isSuperAdmin = (req) => req.user?.systemRole === 'SUPER_ADMIN'

// Seul un Super administrateur crée, modifie ou promeut un Super administrateur
// (le secrétariat peut créer et modifier des comptes, pas ceux-là).
async function assertCanManage(req, targetId, newRole) {
  if (newRole !== undefined && !SYSTEM_ROLES.includes(newRole)) throw new HttpError(400, 'Rôle système invalide')
  if (isSuperAdmin(req)) return
  if (newRole === 'SUPER_ADMIN') throw new HttpError(403, 'Seul un Super administrateur peut créer un Super administrateur')
  if (targetId) {
    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { systemRole: true } })
    if (target?.systemRole === 'SUPER_ADMIN') throw new HttpError(403, 'Ce compte ne peut être modifié que par un Super administrateur')
  }
}

// Un Super administrateur ne peut pas se bloquer ou se supprimer lui-même.
function assertNotSelf(req, targetId, action) {
  if (req.user?.sub === targetId) throw new HttpError(400, `Vous ne pouvez pas ${action} votre propre compte`)
}

async function attachSuperAdminRole(userId) {
  const role = await prisma.role.findUnique({ where: { name: 'Super Administrateur' }, select: { id: true } })
  if (role && !(await prisma.userRole.findFirst({ where: { userId, roleId: role.id } }))) {
    await prisma.userRole.create({ data: { userId, roleId: role.id } })
  }
}

const USER_INCLUDE = {
  userRoles: {
    include: {
      role: { select: { id: true, name: true, color: true } },
      mention: { select: { id: true, name: true } },
      campus: { select: { id: true, name: true } },
    },
  },
  studentProfile: { select: { matricule: true, status: true, mention: { select: { name: true } } } },
  teacherProfile: { select: { employeeId: true, specialization: true } },
  staffProfile: { select: { employeeId: true, department: true } },
  candidateProfile: { select: { status: true } },
}

export const listUsers = async (req, res) => {
  const { search, systemRole, page = 1, limit = 20 } = req.query
  const where = {}
  if (search) {
    where.OR = [
      { email: { contains: search } },
      { firstName: { contains: search } },
      { lastName: { contains: search } },
    ]
  }
  if (systemRole) where.systemRole = systemRole

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where, include: USER_INCLUDE,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
  ])
  res.json({ total, page: Number(page), limit: Number(limit), users: users.map(sanitize) })
}

export const getUser = async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, include: USER_INCLUDE })
  if (!user) throw new HttpError(404, 'Utilisateur non trouvé')
  res.json(sanitize(user))
}

export const createUser = async (req, res) => {
  const { password, firstName, lastName, phone, systemRole, avatarUrl } = req.body
  const email = String(req.body.email ?? '').toLowerCase().trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Adresse e-mail invalide')
  if (!firstName?.trim() || !lastName?.trim()) throw new HttpError(400, 'Prénom et nom obligatoires')
  await assertCanManage(req, null, systemRole)
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new HttpError(409, 'Email déjà utilisé')
  if (password && password.length < 8) throw new HttpError(400, 'Mot de passe trop court (8 caractères minimum)')
  // Sans mot de passe saisi : un mot de passe provisoire, renvoyé une seule fois.
  const temporaryPassword = password ? undefined : generateTempPassword()

  const user = await prisma.user.create({
    data: {
      email, firstName, lastName, phone, systemRole, avatarUrl,
      passwordHash: await hashPassword(password || temporaryPassword),
      emailVerified: true,
      isActive: true,
    },
    include: USER_INCLUDE,
  })
  // Fiche de profil du rôle (enseignant, personnel, parent…) pour la page « Mon profil »
  await ensureProfile(user.id, user.systemRole)
  if (user.systemRole === 'SUPER_ADMIN') await attachSuperAdminRole(user.id)
  const full = await prisma.user.findUnique({ where: { id: user.id }, include: USER_INCLUDE })
  // E-mail d'accueil : identifiant, lien de connexion et mot de passe provisoire s'il a été généré.
  const emailSent = await sendAccountCreatedEmail(user, { temporaryPassword })
  res.status(201).json({ ...sanitize(full), emailSent, ...(temporaryPassword && { temporaryPassword }) })
}

export const updateUser = async (req, res) => {
  const b = req.body ?? {}
  await assertCanManage(req, req.params.id, b.systemRole)
  // Champs modifiables uniquement (l'adresse e-mail sert d'identifiant : elle ne change pas ici).
  const data = {}
  for (const k of ['firstName', 'lastName', 'phone', 'systemRole', 'avatarUrl']) if (b[k] !== undefined) data[k] = b[k]
  if (data.systemRole && data.systemRole !== 'SUPER_ADMIN') assertNotSelf(req, req.params.id, 'retirer le rôle Super administrateur de')
  if (b.password) {
    if (String(b.password).length < 8) throw new HttpError(400, 'Mot de passe trop court (8 caractères minimum)')
    data.passwordHash = await hashPassword(String(b.password))
  }
  const user = await prisma.user.update({ where: { id: req.params.id }, data, include: USER_INCLUDE })
  if (data.systemRole === 'SUPER_ADMIN') await attachSuperAdminRole(user.id)
  if (data.passwordHash) await prisma.refreshToken.deleteMany({ where: { userId: user.id } })
  res.json(sanitize(user))
}

export const deleteUser = async (req, res) => {
  assertNotSelf(req, req.params.id, 'supprimer')
  await assertCanManage(req, req.params.id)
  await prisma.user.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
}

export const blockUser = async (req, res) => {
  assertNotSelf(req, req.params.id, 'bloquer')
  await assertCanManage(req, req.params.id)
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } })
  await prisma.refreshToken.deleteMany({ where: { userId: req.params.id } })
  res.json({ ok: true, isActive: user.isActive })
}

export const unblockUser = async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { isActive: true } })
  res.json({ ok: true, isActive: user.isActive })
}

export const resetPassword = async (req, res) => {
  // L'écran d'administration envoie « newPassword ».
  const chosen = req.body?.newPassword ?? req.body?.password
  if (chosen && String(chosen).length < 8) throw new HttpError(400, 'Mot de passe trop court (8 caractères minimum)')
  await assertCanManage(req, req.params.id)
  const temporaryPassword = chosen ? undefined : generateTempPassword()
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { passwordHash: await hashPassword(chosen ? String(chosen) : temporaryPassword) },
    select: { email: true, firstName: true, systemRole: true },
  })
  // Un changement de mot de passe ferme les sessions ouvertes du compte.
  await prisma.refreshToken.deleteMany({ where: { userId: req.params.id } })
  // Mot de passe généré : envoyé à la personne par e-mail (et affiché une fois à l'admin).
  const emailSent = temporaryPassword ? await sendPasswordResetByAdminEmail(user, { temporaryPassword }) : false
  res.json({ ok: true, emailSent, ...(temporaryPassword && { temporaryPassword }) })
}

export const assignRole = async (req, res) => {
  const { roleId, mentionId, facultyId, departmentId, campusId } = req.body
  const ur = await prisma.userRole.create({
    data: { userId: req.params.id, roleId, mentionId, facultyId, departmentId, campusId },
    include: { role: { select: { name: true, color: true } }, mention: { select: { name: true } } },
  })
  res.status(201).json(ur)
}

export const removeRole = async (req, res) => {
  await prisma.userRole.deleteMany({ where: { userId: req.params.userId, roleId: req.params.roleId } })
  res.json({ ok: true })
}

export const dashboardStats = async (req, res) => {
  const [users, students, teachers, candidates, mentions, promotions] = await Promise.all([
    prisma.user.count(),
    prisma.studentProfile.count({ where: { status: 'ACTIVE' } }),
    prisma.teacherProfile.count(),
    prisma.candidate.count({ where: { status: 'SUBMITTED' } }),
    prisma.mention.count({ where: { isActive: true } }),
    prisma.promotion.count(),
  ])
  res.json({ users, students, teachers, pendingCandidates: candidates, mentions, promotions })
}

function sanitize(u) {
  const { passwordHash, ...rest } = u
  return rest
}
