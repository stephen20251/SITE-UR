import { verifyAccessToken } from '../utils/jwt.js';
import { HttpError } from '../utils/asyncHandler.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Missing or invalid Authorization header'));
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.user = payload; // { sub, role, system, email }
    next();
  } catch (e) {
    next(e);
  }
}

// Hybrid campus: university students/teachers also use the ONLINE platform
// (cursus universitaire + cours certifiants). A university STUDENT satisfies an
// online-student check, a university TEACHER an online-teacher check.
const ROLE_ALIASES = {
  STUDENT_ONLINE: ['STUDENT'],
  TEACHER_ONLINE: ['TEACHER'],
};
const HYBRID_ONLINE_ROLES = ['STUDENT', 'TEACHER'];

export function hasRole(user, role) {
  if (!user) return false;
  return user.role === role || (ROLE_ALIASES[role] ?? []).includes(user.role);
}
export const isOnlineStudent = (user) => hasRole(user, 'STUDENT_ONLINE');
export const isOnlineTeacher = (user) => hasRole(user, 'TEACHER_ONLINE');
// University student (has a StudentProfile) — sees the "cursus universitaire".
export const isUniversityStudent = (user) => user?.role === 'STUDENT';

// Role-based: allow if user.role ∈ roles. SUPER_ADMIN bypasses all role checks.
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'Unauthenticated'));
  if (req.user.role === 'SUPER_ADMIN' || req.user.systemRole === 'SUPER_ADMIN') return next();
  if (!roles.some((r) => hasRole(req.user, r))) {
    return next(new HttpError(403, `Forbidden — required role: ${roles.join('|')}`));
  }
  next();
};

// System-based: ONLINE vs CLASSROOM isolation. SUPER_ADMIN bypasses system checks.
// University students and teachers are hybrid: they also reach the ONLINE system.
export const requireSystem = (system) => (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'Unauthenticated'));
  if (req.user.role === 'SUPER_ADMIN' || req.user.systemRole === 'SUPER_ADMIN') return next();
  const hybrid = system === 'ONLINE' && HYBRID_ONLINE_ROLES.includes(req.user.role);
  if (req.user.system !== system && !hybrid) {
    return next(new HttpError(403, `Forbidden — requires ${system} system access`));
  }
  next();
};
