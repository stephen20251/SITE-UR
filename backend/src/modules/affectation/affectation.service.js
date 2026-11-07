import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';

const TEACHER_INCLUDE = {
  teacher: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      mention: { select: { name: true } },
    },
  },
  subject: { select: { id: true, code: true, name: true, credits: true } },
  group:   { select: { id: true, name: true } },
};

// ── List assignments for a subject ───────────────────────────────────────────

export async function listBySubject(subjectId) {
  return prisma.subjectTeacher.findMany({
    where: { subjectId },
    include: TEACHER_INCLUDE,
    orderBy: { assignedAt: 'asc' },
  });
}

// ── List all assignments with filters ────────────────────────────────────────

export async function listAssignments({ semesterId, mentionId, subjectId, teacherId, page = 1, limit = 50 }) {
  const where = {};
  if (subjectId)  where.subjectId  = subjectId;
  if (teacherId)  where.teacherId  = teacherId;
  if (mentionId || semesterId) {
    where.subject = {
      ...(mentionId   && { mentionId }),
      ...(semesterId  && { teachingUnit: { semesterId } }),
    };
  }

  const [total, items] = await Promise.all([
    prisma.subjectTeacher.count({ where }),
    prisma.subjectTeacher.findMany({
      where,
      include: TEACHER_INCLUDE,
      orderBy: [{ subject: { name: 'asc' } }, { assignedAt: 'asc' }],
      skip:  (page - 1) * limit,
      take:  limit,
    }),
  ]);
  return { total, page, limit, items };
}

// ── Assign teacher to subject ─────────────────────────────────────────────────

export async function assignTeacher({ subjectId, teacherId, groupId, type, assignedBy }) {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) throw new HttpError(404, 'Matière introuvable');

  const teacher = await prisma.teacherProfile.findUnique({ where: { id: teacherId } });
  if (!teacher) throw new HttpError(404, 'Enseignant introuvable');

  const existing = await prisma.subjectTeacher.findFirst({
    where: { subjectId, teacherId, groupId: groupId ?? null, type: type ?? 'CM' },
  });
  if (existing) throw new HttpError(409, 'Cette affectation existe déjà');

  return prisma.subjectTeacher.create({
    data: {
      subjectId,
      teacherId,
      groupId: groupId || null,
      type: type ?? 'CM',
      assignedBy,
    },
    include: TEACHER_INCLUDE,
  });
}

// ── Remove an assignment ──────────────────────────────────────────────────────

export async function removeAssignment(id) {
  const aff = await prisma.subjectTeacher.findUnique({ where: { id } });
  if (!aff) throw new HttpError(404, 'Affectation introuvable');
  await prisma.subjectTeacher.delete({ where: { id } });
  return { success: true };
}

// ── Update assignment type ────────────────────────────────────────────────────

export async function updateAssignment(id, { type, groupId }) {
  const aff = await prisma.subjectTeacher.findUnique({ where: { id } });
  if (!aff) throw new HttpError(404, 'Affectation introuvable');
  return prisma.subjectTeacher.update({
    where: { id },
    data: { type: type ?? aff.type, groupId: groupId !== undefined ? (groupId || null) : aff.groupId },
    include: TEACHER_INCLUDE,
  });
}

// ── List subjects for cascade ─────────────────────────────────────────────────

export async function listSubjectsForAssignment({ mentionId, semesterId } = {}) {
  return prisma.subject.findMany({
    where: {
      ...(mentionId  && { mentionId }),
      ...(semesterId && { teachingUnit: { semesterId } }),
      isActive: true,
    },
    include: {
      mention:      { select: { id: true, name: true } },
      teachingUnit: { select: { id: true, name: true, code: true, semesterId: true } },
      subjectTeachers: { include: {
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        group:   { select: { id: true, name: true } },
      }},
    },
    orderBy: { name: 'asc' },
  });
}
