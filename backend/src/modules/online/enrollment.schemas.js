import { z } from 'zod';

export const courseIdParam = z.object({ courseId: z.string().uuid() });
export const lessonIdParam = z.object({ lessonId: z.string().uuid() });
export const certCodeParam = z.object({ code: z.string().trim().min(3).max(60) });

export const listEnrollQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const progressBody = z
  .object({
    completed: z.boolean().optional(),
    watchedSec: z.coerce.number().int().min(0).max(86400).optional(),
  })
  .strict()
  .refine((d) => d.completed !== undefined || d.watchedSec !== undefined, {
    message: 'Provide at least one of: completed, watchedSec',
  });
