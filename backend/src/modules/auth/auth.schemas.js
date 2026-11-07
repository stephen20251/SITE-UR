import { z } from 'zod';

export const ROLE_VALUES = [
  'STUDENT_ONLINE', 'TEACHER_ONLINE',
  'STUDENT_CLASSROOM', 'TEACHER_CLASSROOM', 'ADMIN',
  'CHEF_DE_MENTION', 'SECRETARY', 'TREASURER',
  'PEDAGOGICAL_MANAGER', 'PARENT',
];

export const SYSTEM_VALUES = ['ONLINE', 'CLASSROOM'];

const ONLINE_ROLES = new Set(['STUDENT_ONLINE', 'TEACHER_ONLINE']);

export const registerSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  role: z.enum(ROLE_VALUES),
  system: z.enum(SYSTEM_VALUES),
  phone: z.string().trim().max(40).optional(),
}).refine(
  (d) => (ONLINE_ROLES.has(d.role) ? d.system === 'ONLINE' : d.system === 'CLASSROOM'),
  { message: 'Role does not match system', path: ['role'] },
);

// Candidature à l'université (compte CANDIDATE + dossier en brouillon)
export const registerCandidateSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).optional(),
  mentionId: z.string().uuid().optional(),
  level: z.enum(['L1', 'L2', 'L3', 'M1', 'M2']).optional(),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
