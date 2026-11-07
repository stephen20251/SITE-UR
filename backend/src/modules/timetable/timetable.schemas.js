import { z } from 'zod';

export const idParam = z.object({ id: z.string().uuid() });
export const classIdParam = z.object({ classId: z.string().uuid() });

const TIME = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM (24h)');

export const createEntryBody = z
  .object({
    classId: z.string().uuid(),
    subject: z.string().trim().min(1).max(120),
    teacherId: z.string().uuid().optional(),
    dayOfWeek: z.coerce.number().int().min(1).max(7),
    startTime: TIME,
    endTime: TIME,
    room: z.string().trim().max(40).optional(),
  })
  .strict();

export const updateEntryBody = z
  .object({
    subject: z.string().trim().min(1).max(120).optional(),
    teacherId: z.string().uuid().nullable().optional(),
    dayOfWeek: z.coerce.number().int().min(1).max(7).optional(),
    startTime: TIME.optional(),
    endTime: TIME.optional(),
    room: z.string().trim().max(40).nullable().optional(),
  })
  .strict();

export const timetableQuery = z.object({
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'REJECTED']).optional(),
});

export const rejectBody = z.object({ reason: z.string().trim().max(500).optional() }).strict();
