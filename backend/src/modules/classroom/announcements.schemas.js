import { z } from 'zod';

export const idParam = z.object({ id: z.string().uuid() });

// NOTE: the schema's AnnouncementScope also has DEPARTMENT, but the model has no
// department target column — so creation supports GLOBAL + CLASS (clean to filter).
export const createAnnouncementBody = z
  .object({
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(5000),
    scope: z.enum(['GLOBAL', 'CLASS']),
    classId: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.scope === 'CLASS' && !d.classId) {
      ctx.addIssue({ code: 'custom', path: ['classId'], message: 'classId is required for CLASS scope' });
    }
  });
