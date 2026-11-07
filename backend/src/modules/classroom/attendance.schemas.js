import { z } from 'zod';

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const markAttendanceBody = z
  .object({
    classId: z.string().uuid(),
    date: DATE,
    records: z
      .array(
        z.object({
          studentId: z.string().uuid(),
          status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
          note: z.string().trim().max(200).optional(),
        }),
      )
      .min(1)
      .max(300),
  })
  .strict();

export const listAttendanceQuery = z
  .object({
    classId: z.string().uuid(),
    date: DATE.optional(),
    from: DATE.optional(),
    to: DATE.optional(),
  })
  .strict();

export const classIdParam = z.object({ classId: z.string().uuid() });
