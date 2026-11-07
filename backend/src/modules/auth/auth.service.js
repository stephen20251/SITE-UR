import { prisma } from '../../database/prisma.js';
import { hashPassword, verifyPassword } from '../../utils/hash.js';
import {
  signAccessToken, signRefreshToken,
  verifyRefreshToken, hashToken,
} from '../../utils/jwt.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { env } from '../../config/env.js';

function ttlMs(ttl) {
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) return 7 * 86400_000;
  const n = Number(m[1]);
  return n * ({ s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 })[m[2]];
}

async function loadUserWithRoles(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: { include: { rolePermissions: { include: { permission: true } } } },
          mention: { select: { id: true, name: true, code: true } },
          campus: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });
}

function buildRolesPayload(userRoles = []) {
  return userRoles.map(ur => ({
    roleId: ur.roleId,
    roleName: ur.role.name,
    color: ur.role.color,
    scope: {
      mentionId: ur.mentionId,
      mentionName: ur.mention?.name ?? null,
      facultyId: ur.facultyId,
      departmentId: ur.departmentId,
      campusId: ur.campusId,
    },
    permissions: ur.role.rolePermissions.map(rp => rp.permission.code),
  }))
}

function tokensFor(user) {
  // Legacy compat: online module checks req.user.role and req.user.system
  const isOnline = ['STUDENT_ONLINE', 'TEACHER_ONLINE'].includes(user.systemRole)
  const payload = {
    sub: user.id,
    systemRole: user.systemRole,
    email: user.email,
    // backwards-compat fields for online module
    role: user.systemRole,
    system: isOnline ? 'ONLINE' : 'CLASSROOM',
  }
  return {
    accessToken:  signAccessToken(payload),
    refreshToken: signRefreshToken({ sub: user.id }),
  };
}

async function persistRefreshToken(userId, refreshToken) {
  await prisma.refreshToken.create({
    data: {
      userId,
      token: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + ttlMs(env.JWT_REFRESH_EXPIRES)),
    },
  });
}

export async function login(input) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive) throw new HttpError(401, 'Identifiants invalides');

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw new HttpError(401, 'Identifiants invalides');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const full = await loadUserWithRoles(user.id);
  const tokens = tokensFor(user);
  await persistRefreshToken(user.id, tokens.refreshToken);

  return { user: sanitize(full), roles: buildRolesPayload(full.userRoles), ...tokens };
}

export async function refresh(rawRefreshToken) {
  let payload;
  try { payload = verifyRefreshToken(rawRefreshToken); }
  catch { throw new HttpError(401, 'Refresh token invalide'); }

  const stored = await prisma.refreshToken.findUnique({ where: { token: hashToken(rawRefreshToken) } });
  if (!stored || stored.expiresAt < new Date()) throw new HttpError(401, 'Refresh token expiré');

  const user = await loadUserWithRoles(payload.sub);
  if (!user || !user.isActive) throw new HttpError(401, 'Compte inactif');

  await prisma.refreshToken.delete({ where: { id: stored.id } });
  const tokens = tokensFor(user);
  await persistRefreshToken(user.id, tokens.refreshToken);

  return { user: sanitize(user), roles: buildRolesPayload(user.userRoles), ...tokens };
}

export async function logout(rawRefreshToken) {
  await prisma.refreshToken.deleteMany({ where: { token: hashToken(rawRefreshToken) } });
  return { ok: true };
}

export async function me(userId) {
  const user = await loadUserWithRoles(userId);
  if (!user) throw new HttpError(404, 'Utilisateur non trouvé');
  return { user: sanitize(user), roles: buildRolesPayload(user.userRoles) };
}

export async function registerCandidate(input) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new HttpError(409, 'Email déjà utilisé');

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      systemRole: 'CANDIDATE',
      candidateProfile: { create: { level: input.level ?? 'L1', mentionId: input.mentionId ?? null } },
    },
  });

  const full = await loadUserWithRoles(user.id);
  const tokens = tokensFor(user);
  await persistRefreshToken(user.id, tokens.refreshToken);
  return { user: sanitize(full), roles: [], ...tokens };
}

function sanitize(u) {
  const { passwordHash, ...rest } = u;
  const isOnline = ['STUDENT_ONLINE', 'TEACHER_ONLINE'].includes(u.systemRole);
  return {
    ...rest,
    system: isOnline ? 'ONLINE' : 'CLASSROOM',
    role: u.systemRole, // compat for online.login.tsx which reads user.role
  };
}
