import { z } from 'zod';

export const idParam = z.object({ id: z.string().uuid() });
export const classIdParam = z.object({ classId: z.string().uuid() });

export const createGradeBody = z
  .object({
    classId: z.string().uuid(),
    studentId: z.string().uuid(),
    subject: z.string().trim().min(1).max(120),
    assessment: z.string().trim().min(1).max(120),
    score: z.coerce.number().min(0),
    maxScore: z.coerce.number().min(1).max(1000).default(20),
    weight: z.coerce.number().min(0).max(100).default(1),
    comment: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((d) => d.score <= d.maxScore, { message: 'score cannot exceed maxScore', path: ['score'] });

export const listGradesQuery = z
  .object({
    classId: z.string().uuid().optional(),
    studentId: z.string().uuid().optional(),
    subject: z.string().trim().max(120).optional(),
  })
  .strict()
  .refine((d) => d.classId || d.studentId, { message: 'classId or studentId is required' });
