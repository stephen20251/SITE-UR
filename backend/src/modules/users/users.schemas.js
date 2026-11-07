import { z } from 'zod';
import { ROLE_VALUES } from '../auth/auth.schemas.js';

export const idParam   = z.object({ id: z.string().uuid() });

export const listQuery = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  role:   z.enum(ROLE_VALUES).optional(),
  system: z.enum(['ONLINE', 'CLASSROOM']).optional(),
  q:      z.string().trim().max(80).optional(),
});

export const updateUserBody = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName:  z.string().trim().min(1).max(80).optional(),
  phone:     z.string().trim().max(40).optional(),
  avatarUrl: z.string().url().optional(),
  isActive:  z.boolean().optional(),
}).strict();

export const changeRoleBody = z.object({
  role: z.enum(ROLE_VALUES),
});
