import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.js'
import { requirePermission, requireSystemRole } from '../../middlewares/rbac.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import * as svc from './admin.service.js'
import * as rbacSvc from './rbac.service.js'

const r = Router()
r.use(authenticate)

// ── Users ─────────────────────────────────────────────────────────
r.get('/users',                           requirePermission('VIEW_ALL_USERS'), asyncHandler(svc.listUsers))
r.get('/users/:id',                       requirePermission('VIEW_ALL_USERS'), asyncHandler(svc.getUser))
r.post('/users',                          requirePermission('CREATE_USER'), asyncHandler(svc.createUser))
r.put('/users/:id',                       requirePermission('EDIT_USER'), asyncHandler(svc.updateUser))
r.delete('/users/:id',                    requirePermission('DELETE_USER'), asyncHandler(svc.deleteUser))
r.put('/users/:id/block',                 requirePermission('BLOCK_USER'), asyncHandler(svc.blockUser))
r.put('/users/:id/unblock',               requirePermission('BLOCK_USER'), asyncHandler(svc.unblockUser))
r.put('/users/:id/reset-password',        requirePermission('RESET_PASSWORD'), asyncHandler(svc.resetPassword))
r.post('/users/:id/roles',                requirePermission('ASSIGN_ROLE'), asyncHandler(svc.assignRole))
r.delete('/users/:userId/roles/:roleId',  requirePermission('ASSIGN_ROLE'), asyncHandler(svc.removeRole))

// ── RBAC ──────────────────────────────────────────────────────────
r.get('/roles',                           asyncHandler(rbacSvc.listRoles))
r.post('/roles',                          requireSystemRole('SUPER_ADMIN'), asyncHandler(rbacSvc.createRole))
r.put('/roles/:id',                       requireSystemRole('SUPER_ADMIN'), asyncHandler(rbacSvc.updateRole))
r.delete('/roles/:id',                    requireSystemRole('SUPER_ADMIN'), asyncHandler(rbacSvc.deleteRole))
r.get('/roles/:id/permissions',           asyncHandler(rbacSvc.getRolePermissions))
r.put('/roles/:id/permissions',           requireSystemRole('SUPER_ADMIN'), asyncHandler(rbacSvc.setRolePermissions))
r.get('/permissions',                     asyncHandler(rbacSvc.listPermissions))

// ── Dashboard stats ───────────────────────────────────────────────
r.get('/stats',                           requireSystemRole('SUPER_ADMIN'), asyncHandler(svc.dashboardStats))

export default r
