import { z } from 'zod';

export const createFeeBody = z.object({
  name: z.string().min(1),
  academicYear: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default('EUR'),
  description: z.string().optional(),
});

export const createPaymentBody = z.object({
  studentId: z.string().uuid(),
  feeId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.string().optional(),
  reference: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

export const updatePaymentBody = z.object({
  status: z.enum(['PENDING', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED']).optional(),
  method: z.string().optional(),
  reference: z.string().optional(),
  paidAt: z.string().datetime().optional(),
  amount: z.number().positive().optional(),
}).strict();

export const idParam = z.object({ id: z.string().uuid() });
