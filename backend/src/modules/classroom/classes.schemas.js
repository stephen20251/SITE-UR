import { z } from 'zod';

export const idParam = z.object({ id: z.string().uuid() });
export const studentParam = z.object({ id: z.string().uuid(), userId: z.string().uuid() });

export const listClassesQuery = z.object({
  departmentId: z.string().uuid().optional(),
  academicYear: z.string().trim().max(20).optional(),
});

export const createClassBody = z
  .object({
    name: z.string().trim().min(1).max(80),
    level: z.string().trim().min(1).max(40),
    academicYear: z.string().trim().min(4).max(20),
    departmentId: z.string().uuid(),
  })
  .strict();

export const updateClassBody = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    level: z.string().trim().min(1).max(40).optional(),
    academicYear: z.string().trim().min(4).max(20).optional(),
    departmentId: z.string().uuid().optional(),
  })
  .strict();

export const assignStudentBody = z.object({ studentId: z.string().uuid() }).strict();
