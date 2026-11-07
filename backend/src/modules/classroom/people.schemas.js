import { z } from 'zod';

export const userIdParam = z.object({ userId: z.string().uuid() });

export const listPeopleQuery = z.object({
  departmentId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  q: z.string().trim().max(80).optional(),
});

export const createStudentBody = z
  .object({
    userId: z.string().uuid(),
    studentNo: z.string().trim().min(1).max(40),
    departmentId: z.string().uuid().optional(),
    classId: z.string().uuid().optional(),
    enrolledYear: z.coerce.number().int().min(2000).max(2100),
  })
  .strict();

export const updateStudentBody = z
  .object({
    studentNo: z.string().trim().min(1).max(40).optional(),
    departmentId: z.string().uuid().nullable().optional(),
    classId: z.string().uuid().nullable().optional(),
    enrolledYear: z.coerce.number().int().min(2000).max(2100).optional(),
  })
  .strict();

export const createTeacherBody = z
  .object({
    userId: z.string().uuid(),
    staffNo: z.string().trim().min(1).max(40),
    departmentId: z.string().uuid().optional(),
  })
  .strict();

export const updateTeacherBody = z
  .object({
    staffNo: z.string().trim().min(1).max(40).optional(),
    departmentId: z.string().uuid().nullable().optional(),
  })
  .strict();
