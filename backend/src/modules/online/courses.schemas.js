import { z } from 'zod';

export const idParam = z.object({ id: z.string().uuid() });
export const slugParam = z.object({ slug: z.string().trim().min(1).max(120) });

// Cursus universitaire : type de cours, niveau, mois, cours liés.
const cursusFields = {
  courseKind:       z.enum(['UNIVERSITY', 'CERTIFYING', 'BOTH']).optional(),
  credentialType:   z.enum(['CERTIFICATE', 'ATTESTATION']).optional(),
  mentionId:        z.string().uuid().nullable().optional(),
  cursusLevel:      z.enum(['L1', 'L2', 'L3', 'M1', 'M2']).nullable().optional(),
  cursusMonth:      z.number().int().min(1).max(8).nullable().optional(),
  subjectId:        z.string().uuid().nullable().optional(),
  relatedCourseIds: z.array(z.string().uuid()).max(10).optional(),
  totalHours:       z.number().positive().max(1000).nullable().optional(),
};

export const createCourseBody = z.object({
  ...cursusFields,
  price:           z.number().min(0).optional(),
  curriculumEntryId: z.string().uuid().optional(),
  title:           z.string().trim().min(3).max(160),
  subtitle:        z.string().trim().max(200).optional(),
  description:     z.string().trim().max(10000).optional(),
  language:        z.string().trim().max(10).optional(),
  level:           z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  categoryId:      z.string().uuid().optional(),
  tags:            z.array(z.string().trim().max(40)).max(15).optional(),
  thumbnail:       z.string().url().optional(),
  hasCertificate:  z.boolean().optional(),
  estimatedHours:  z.number().positive().optional(),
});

export const updateCourseBody = z.object({
  ...cursusFields,
  title:           z.string().trim().min(3).max(160).optional(),
  subtitle:        z.string().trim().max(200).nullable().optional(),
  description:     z.string().trim().max(10000).nullable().optional(),
  thumbnail:       z.string().nullable().optional(),
  previewVideoUrl: z.string().nullable().optional(),
  language:        z.string().trim().max(10).optional(),
  level:           z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).nullable().optional(),
  categoryId:      z.string().uuid().nullable().optional(),
  tags:            z.array(z.string().trim().max(40)).max(15).optional(),
  isFeatured:      z.boolean().optional(),
  hasCertificate:  z.boolean().optional(),
  estimatedHours:  z.number().positive().nullable().optional(),
  objectives:      z.array(z.string().trim().max(200)).max(20).optional(),
  skills:          z.array(z.string().trim().max(200)).max(20).optional(),
  audience:        z.string().trim().max(1000).nullable().optional(),
  prerequisites:   z.string().trim().max(1000).nullable().optional(),
  price:           z.number().min(0).optional(),
  status:          z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  publishedAt:     z.string().datetime().nullable().optional(),
});

export const listCoursesQuery = z.object({
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(50).default(12),
  q:          z.string().trim().max(120).optional(),
  categoryId: z.string().uuid().optional(),
  sort:       z.enum(['recent', 'rating', 'popular']).optional(),
  level:      z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  free:       z.coerce.boolean().optional(),
  minRating:  z.coerce.number().min(0).max(5).optional(),
  kind:       z.enum(['ALL', 'UNIVERSITY', 'CERTIFYING']).optional(),
  cursusLevel: z.enum(['L1', 'L2', 'L3', 'M1', 'M2']).optional(),
  mentionId:  z.string().uuid().optional(),
});

export const listMineQuery = listCoursesQuery.extend({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});
