import { z } from 'zod';

export const idParam = z.object({ id: z.string().uuid() });

export const createDepartmentBody = z
  .object({
    name: z.string().trim().min(2).max(120),
    code: z.string().trim().min(1).max(20).toUpperCase(),
  })
  .strict();

export const updateDepartmentBody = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    code: z.string().trim().min(1).max(20).toUpperCase().optional(),
  })
  .strict();
