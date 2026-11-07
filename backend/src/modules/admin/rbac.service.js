import { prisma } from '../../database/prisma.js'
import { HttpError } from '../../utils/asyncHandler.js'

export const listRoles = async (req, res) => {
  const roles = await prisma.role.findMany({
    include: {
      _count: { select: { userRoles: true, rolePermissions: true } },
    },
    orderBy: { name: 'asc' },
  })
  res.json(roles)
}

export const createRole = async (req, res) => {
  const role = await prisma.role.create({ data: req.body })
  res.status(201).json(role)
}

export const updateRole = async (req, res) => {
  const { id } = req.params
  const role = await prisma.role.findUnique({ where: { id } })
  if (!role) throw new HttpError(404, 'Rôle non trouvé')
  const updated = await prisma.role.update({ where: { id }, data: req.body })
  res.json(updated)
}

export const deleteRole = async (req, res) => {
  const role = await prisma.role.findUnique({ where: { id: req.params.id } })
  if (!role) throw new HttpError(404, 'Rôle non trouvé')
  if (role.isSystem) throw new HttpError(403, 'Ce rôle système ne peut pas être supprimé')
  await prisma.role.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
}

export const getRolePermissions = async (req, res) => {
  const rps = await prisma.rolePermission.findMany({
    where: { roleId: req.params.id },
    include: { permission: true },
  })
  res.json(rps.map(rp => rp.permission))
}

export const setRolePermissions = async (req, res) => {
  const { permissionCodes } = req.body
  const perms = await prisma.permission.findMany({ where: { code: { in: permissionCodes } } })

  await prisma.rolePermission.deleteMany({ where: { roleId: req.params.id } })
  await prisma.rolePermission.createMany({
    data: perms.map(p => ({ roleId: req.params.id, permissionId: p.id })),
    skipDuplicates: true,
  })
  res.json({ ok: true, count: perms.length })
}

export const listPermissions = async (req, res) => {
  const perms = await prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] })
  // group by module
  const grouped = {}
  for (const p of perms) {
    if (!grouped[p.module]) grouped[p.module] = []
    grouped[p.module].push(p)
  }
  res.json(grouped)
}
