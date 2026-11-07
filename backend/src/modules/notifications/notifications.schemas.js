import { z } from 'zod';

export const idParam = z.object({ id: z.string().uuid() });

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
