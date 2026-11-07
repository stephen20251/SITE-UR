import { prisma } from '../database/prisma.js'
import { HttpError } from '../utils/asyncHandler.js'

// Loads user permissions from DB and checks if they have the required permission code.
// Optionally scope-checks (mentionId) if present in the token.
export const requirePermission = (...permCodes) => async (req, res, next) => {
  try {
    if (!req.user) return next(new HttpError(401, 'Non authentifié'))

    // SUPER_ADMIN bypasses all permission checks
    if (req.user.systemRole === 'SUPER_ADMIN') return next()

    const userRoles = await prisma.userRole.findMany({
      where: { userId: req.user.sub },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    })

    const allPerms = new Set()
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        allPerms.add(rp.permission.code)
      }
    }

    const hasAll = permCodes.every(c => allPerms.has(c))
    if (!hasAll) {
      return next(new HttpError(403, `Permission requise: ${permCodes.join(', ')}`))
    }
    next()
  } catch (e) {
    next(e)
  }
}

// Loads the caller's permission codes + mention scopes (once per request).
export async function loadStaffContext(req) {
  if (req.staff) return req.staff
  const isAdmin = req.user?.systemRole === 'SUPER_ADMIN'
  const userRoles = isAdmin ? [] : await prisma.userRole.findMany({
    where: { userId: req.user.sub },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  })
  const perms = new Set()
  const mentionIds = new Set()
  const roleNames = []
  for (const ur of userRoles) {
    roleNames.push(ur.role.name)
    if (ur.mentionId) mentionIds.add(ur.mentionId)
    for (const rp of ur.role.rolePermissions) perms.add(rp.permission.code)
  }
  req.staff = {
    isAdmin,
    roleNames,
    mentionIds: [...mentionIds],
    has: (code) => isAdmin || perms.has(code),
  }
  return req.staff
}

// Allow if the user holds AT LEAST ONE of the permission codes.
export const requireAnyPermission = (...permCodes) => async (req, res, next) => {
  try {
    if (!req.user) return next(new HttpError(401, 'Non authentifié'))
    const staff = await loadStaffContext(req)
    if (!permCodes.some((c) => staff.has(c))) {
      return next(new HttpError(403, `Permission requise: ${permCodes.join(' ou ')}`))
    }
    next()
  } catch (e) {
    next(e)
  }
}

// Checks systemRole
export const requireSystemRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'Non authentifié'))
  if (!roles.includes(req.user.systemRole)) {
    return next(new HttpError(403, 'Accès refusé'))
  }
  next()
}
