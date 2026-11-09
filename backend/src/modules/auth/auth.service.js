import { prisma } from '../../database/prisma.js';
import { hashPassword, verifyPassword } from '../../utils/hash.js';
import {
  signAccessToken, signRefreshToken,
  verifyRefreshToken, hashToken,
} from '../../utils/jwt.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { env } from '../../config/env.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { loginPath, sendForgotPasswordEmail } from '../../utils/account-emails.js';

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

// Inscription libre : uniquement les comptes UR Online. Les comptes de l'université
// sont créés par l'administration ; une candidature passe par registerCandidate.
const SELF_REGISTER_ROLES = ['STUDENT_ONLINE', 'TEACHER_ONLINE'];

export async function register(input) {
  if (!SELF_REGISTER_ROLES.includes(input.role)) throw new HttpError(403, 'Ce type de compte est créé par l\'administration');
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new HttpError(409, 'Email déjà utilisé');

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      systemRole: input.role,
    },
  });

  const full = await loadUserWithRoles(user.id);
  const tokens = tokensFor(user);
  await persistRefreshToken(user.id, tokens.refreshToken);
  return { user: sanitize(full), roles: [], ...tokens };
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

// ─── Mot de passe : changement par l'utilisateur, oubli, réinitialisation ─────
const MIN_PASSWORD = 8;

function checkNewPassword(pw) {
  if (typeof pw !== 'string' || pw.length < MIN_PASSWORD) throw new HttpError(400, `Mot de passe trop court (${MIN_PASSWORD} caractères minimum)`);
  if (pw.length > 128) throw new HttpError(400, 'Mot de passe trop long');
}

// L'utilisateur connecté change son mot de passe. Les autres sessions sont fermées ;
// celle en cours est conservée si son jeton de renouvellement est fourni.
export async function changePassword(userId, { currentPassword, newPassword, refreshToken }) {
  checkNewPassword(newPassword);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) throw new HttpError(401, 'Compte inactif');
  if (!(await verifyPassword(String(currentPassword ?? ''), user.passwordHash))) throw new HttpError(400, 'Mot de passe actuel incorrect');
  if (await verifyPassword(newPassword, user.passwordHash)) throw new HttpError(400, 'Choisissez un mot de passe différent de l\'actuel');
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
  const keep = refreshToken ? hashToken(refreshToken) : null;
  await prisma.refreshToken.deleteMany({ where: { userId, ...(keep && { token: { not: keep } }) } });
  return { ok: true };
}

// Lien de réinitialisation : valable 1 h et lié au mot de passe actuel, donc
// inutilisable une fois le mot de passe changé (usage unique).
const RESET_TTL = '1h';
const passwordFingerprint = (passwordHash) => crypto.createHash('sha256').update(passwordHash).digest('hex').slice(0, 24);

export async function forgotPassword(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Même réponse que le compte existe ou non : on ne révèle pas les adresses inscrites.
  if (user?.isActive) {
    const token = jwt.sign({ sub: user.id, typ: 'pwreset', v: passwordFingerprint(user.passwordHash) }, env.JWT_ACCESS_SECRET, { expiresIn: RESET_TTL });
    // Sans attendre l'envoi : temps de réponse identique, compte existant ou non.
    sendForgotPasswordEmail(user, `${env.APP_URL}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`);
  }
  return { ok: true };
}

export async function resetPassword({ token, newPassword }) {
  checkNewPassword(newPassword);
  let payload;
  try {
    payload = jwt.verify(String(token ?? ''), env.JWT_ACCESS_SECRET);
  } catch {
    throw new HttpError(400, 'Lien expiré ou invalide : refaites une demande');
  }
  if (payload.typ !== 'pwreset') throw new HttpError(400, 'Lien expiré ou invalide : refaites une demande');
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive || passwordFingerprint(user.passwordHash) !== payload.v) {
    throw new HttpError(400, 'Ce lien a déjà été utilisé ou n\'est plus valable : refaites une demande');
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  return { ok: true, loginPath: loginPath(user.systemRole) };
}
