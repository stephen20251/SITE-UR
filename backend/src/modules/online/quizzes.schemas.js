import { z } from 'zod';

export const courseIdParam = z.object({ courseId: z.string().uuid() });
export const quizIdParam = z.object({ quizId: z.string().uuid() });

const QUESTION_TYPES = ['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'];

const optionSchema = z.object({
  text: z.string().trim().min(1).max(500),
  isCorrect: z.boolean().default(false),
});

const questionSchema = z
  .object({
    text: z.string().trim().min(1).max(1000),
    type: z.enum(QUESTION_TYPES),
    points: z.coerce.number().min(0.5).max(100).default(1),
    order: z.coerce.number().int().min(0).optional(),
    options: z.array(optionSchema).min(2).max(8),
  })
  .superRefine((q, ctx) => {
    const correct = q.options.filter((o) => o.isCorrect).length;
    if (correct === 0) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'At least one correct option is required' });
    }
    if ((q.type === 'MCQ_SINGLE' || q.type === 'TRUE_FALSE') && correct > 1) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: `${q.type} must have exactly one correct option` });
    }
    if (q.type === 'TRUE_FALSE' && q.options.length !== 2) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'TRUE_FALSE must have exactly two options' });
    }
  });

export const createQuizBody = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    passingScore: z.coerce.number().min(0).max(100).default(50),
    timeLimit: z.coerce.number().int().min(1).max(600).optional(),
    randomize: z.boolean().default(false),
    // Public du test : étudiants du cursus (STUDENT), non-étudiants (PUBLIC) ou tous.
    audience: z.enum(['ALL', 'STUDENT', 'PUBLIC']).default('ALL'),
    poolSize: z.coerce.number().int().min(1).max(100).optional(),
    questions: z.array(questionSchema).min(1).max(100),
  })
  .strict();

// Metadata-only update (re-authoring questions = delete + recreate the quiz).
export const updateQuizBody = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    passingScore: z.coerce.number().min(0).max(100).optional(),
    timeLimit: z.coerce.number().int().min(1).max(600).nullable().optional(),
    randomize: z.boolean().optional(),
    audience: z.enum(['ALL', 'STUDENT', 'PUBLIC']).optional(),
    poolSize: z.coerce.number().int().min(1).max(100).nullable().optional(),
  })
  .strict();

export const submitQuizBody = z
  .object({
    answers: z
      .array(
        z.object({
          questionId: z.string().uuid(),
          selectedOptionIds: z.array(z.string().uuid()).max(8),
        }),
      )
      .min(1),
  })
  .strict();
