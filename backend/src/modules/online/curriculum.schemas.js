import { z } from 'zod';

export const courseIdParam = z.object({ courseId: z.string().uuid() });
export const moduleIdParam = z.object({ moduleId: z.string().uuid() });
export const lessonIdParam = z.object({ lessonId: z.string().uuid() });

const LESSON_TYPES = ['VIDEO', 'PDF', 'TEXT', 'AUDIO', 'DOCUMENT', 'IMAGE', 'ZIP', 'FILE', 'CODE', 'LINK'];

export const createModuleBody = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(500).optional(),
    order: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export const updateModuleBody = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    order: z.coerce.number().int().min(0).optional(),
    dripDays: z.coerce.number().int().min(0).max(365).nullable().optional(),
    prerequisiteModuleId: z.string().uuid().nullable().optional(),
  })
  .strict();

export const createLessonBody = z
  .object({
    title: z.string().trim().min(1).max(200),
    type: z.enum(LESSON_TYPES),
    contentUrl: z.string().url().optional(),
    body: z.string().trim().min(1).max(20000).optional(),
    duration: z.coerce.number().int().min(0).max(86400).optional(),
    order: z.coerce.number().int().min(0).optional(),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.type === 'TEXT' && !d.body) {
      ctx.addIssue({ code: 'custom', path: ['body'], message: 'TEXT lesson requires body' });
    }
  });

export const updateLessonBody = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    type: z.enum(LESSON_TYPES).optional(),
    contentUrl: z.string().url().nullable().optional(),
    body: z.string().trim().min(1).max(20000).nullable().optional(),
    duration: z.coerce.number().int().min(0).max(86400).nullable().optional(),
    order: z.coerce.number().int().min(0).optional(),
    allowDownload: z.boolean().optional(),
    isPreview: z.boolean().optional(),
  })
  .strict();
