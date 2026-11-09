import { prisma } from '../../database/prisma.js'
import { HttpError } from '../../utils/asyncHandler.js'
import { hashPassword } from '../../utils/hash.js'
import { generateTempPassword } from '../../utils/password.js'
import { ensureProfile } from '../me/ensure-profile.js'

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
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
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
  const { email, password, firstName, lastName, phone, systemRole, avatarUrl } = req.body
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
  const full = await prisma.user.findUnique({ where: { id: user.id }, include: USER_INCLUDE })
  res.status(201).json({ ...sanitize(full), ...(temporaryPassword && { temporaryPassword }) })
}

export const updateUser = async (req, res) => {
  const { passwordHash, password, ...data } = req.body
  const user = await prisma.user.update({ where: { id: req.params.id }, data, include: USER_INCLUDE })
  res.json(sanitize(user))
}

export const deleteUser = async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
}

export const blockUser = async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } })
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
  const temporaryPassword = chosen ? undefined : generateTempPassword()
  await prisma.user.update({
    where: { id: req.params.id },
    data: { passwordHash: await hashPassword(chosen ? String(chosen) : temporaryPassword) },
  })
  // Un changement de mot de passe ferme les sessions ouvertes du compte.
  await prisma.refreshToken.deleteMany({ where: { userId: req.params.id } })
  res.json({ ok: true, ...(temporaryPassword && { temporaryPassword }) })
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
