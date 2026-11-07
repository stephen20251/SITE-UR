import { z } from 'zod';

export const roomIdParam = z.object({ roomId: z.string().uuid() });
export const courseIdParam = z.object({ courseId: z.string().uuid() });
export const userIdParam = z.object({ userId: z.string().uuid() });

export const messagesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().datetime().optional(),
});

export const sendMessageBody = z.object({
  body: z.string().trim().min(1).max(4000),
});
