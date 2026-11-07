import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';

const DAYS_ORDER = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];

const PERIOD_INCLUDE = {
  mention: { select: { id: true, name: true, code: true } },
  semester: { select: { id: true, name: true, number: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  validation: true,
  confirmations: true,
  _count: { select: { slots: true, availabilities: true } },
};

const DAY_LABELS = { MONDAY: 'Lundi', TUESDAY: 'Mardi', WEDNESDAY: 'Mercredi', THURSDAY: 'Jeudi', FRIDAY: 'Vendredi', SATURDAY: 'Samedi', SUNDAY: 'Dimanche' };

// Lundi de la semaine prochaine (00:00)
export function nextMonday(from = new Date()) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = dimanche
  d.setDate(d.getDate() + ((8 - day) % 7 || 7));
  return d;
}

// ─── Helpers ─────────────────────────────────────────────────

function assertChefOrAdmin(user) {
  if (!['SUPER_ADMIN', 'STAFF'].includes(user.systemRole)) {
    throw new HttpError(403, 'Réservé au Responsable Pédagogique ou à un administrateur');
  }
}

// Enseignants rattachés à une mention : profil, affectation des matières, plan de cursus, cours
async function teacherUserIdsForMention(mentionId) {
  const [profiles, subjectTeachers, cursus, courses] = await Promise.all([
    prisma.teacherProfile.findMany({ where: { mentionId }, select: { userId: true } }),
    prisma.subjectTeacher.findMany({ where: { subject: { mentionId } }, select: { teacher: { select: { userId: true } } } }),
    prisma.curriculumEntry.findMany({ where: { mentionId, teacherId: { not: null } }, select: { teacherId: true } }),
    prisma.course.findMany({
      where: { promotion: { mentionId } },
      select: { teachers: { select: { teacher: { select: { userId: true } } } } },
    }),
  ]);
  const ids = new Set();
  profiles.forEach((t) => ids.add(t.userId));
  subjectTeachers.forEach((t) => ids.add(t.teacher.userId));
  cursus.forEach((c) => ids.add(c.teacherId));
  courses.forEach((c) => c.teachers.forEach((t) => ids.add(t.teacher.userId)));
  return [...ids];
}

// Detect conflicts for a candidate slot
async function detectConflicts(periodId, { teacherUserId, roomId, promotionId, day, startTime, endTime, excludeSlotId }) {
  const conflicts = [];
  const where = { schedulePeriodId: periodId, day, id: { not: excludeSlotId ?? '' } };

  const overlap = (s1, e1, s2, e2) => s1 < e2 && e1 > s2;

  const slots = await prisma.scheduleSlot.findMany({ where });
  for (const s of slots) {
    if (!overlap(startTime, endTime, s.startTime, s.endTime)) continue;
    if (s.teacherUserId === teacherUserId) conflicts.push({ type: 'TEACHER_BUSY', slot: s });
    if (roomId && s.roomId === roomId) conflicts.push({ type: 'ROOM_BUSY', slot: s });
    if (s.promotionId === promotionId) conflicts.push({ type: 'PROMOTION_BUSY', slot: s });
  }

  // Check teacher availability
  if (teacherUserId) {
    // Les blocs cochés contigus (ex. 07h-09h + 09h-11h) couvrent un créneau de 07h à 11h
    const avail = await prisma.teacherAvailability.findMany({
      where: { schedulePeriodId: periodId, teacherUserId, day, isAvailable: true },
      orderBy: { startTime: 'asc' },
    });
    let cursor = startTime;
    let moved = true;
    while (cursor < endTime && moved) {
      moved = false;
      for (const a of avail) {
        if (a.startTime <= cursor && a.endTime > cursor) { cursor = a.endTime; moved = true; }
      }
    }
    if (cursor < endTime) conflicts.push({ type: 'TEACHER_UNAVAILABLE' });
  }

  return conflicts;
}

// ─── Helpers (teacher-to-mention reverse lookup) ──────────────

async function mentionIdsForTeacher(teacherUserId) {
  const tp = await prisma.teacherProfile.findUnique({
    where: { userId: teacherUserId },
    select: { id: true },
  });
  if (!tp) return [];
  const rows = await prisma.courseTeacher.findMany({
    where: { teacherId: tp.id },
    select: { course: { select: { promotion: { select: { mentionId: true } } } } },
  });
  return [...new Set(rows.map(r => r.course?.promotion?.mentionId).filter(Boolean))];
}

// ─── Schedule Periods ─────────────────────────────────────────

export async function createPeriod(user, { mentionId, semesterId, name, availabilityDeadline, publishAt, weekStart }) {
  assertChefOrAdmin(user);
  const monday = weekStart ? new Date(weekStart) : nextMonday();
  const period = await prisma.schedulePeriod.create({
    data: {
      mentionId, semesterId, name,
      weekStart: monday,
      createdById: user.sub,
      availabilityDeadline: availabilityDeadline ? new Date(availabilityDeadline) : null,
      publishAt: publishAt ? new Date(publishAt) : null,
      status: 'PREPARING',
    },
    include: PERIOD_INCLUDE,
  });

  // Notify every teacher linked to this mention
  const teacherIds = await teacherUserIdsForMention(mentionId);
  if (teacherIds.length) {
    const mention = period.mention?.name ?? '';
    const deadlineStr = availabilityDeadline
      ? new Date(availabilityDeadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;
    await prisma.notification.createMany({
      data: teacherIds.map(userId => ({
        userId,
        type: 'INFO',
        title: `📅 Demande de disponibilité — ${name}`,
        body: `Le Responsable Pédagogique de la mention ${mention} vous demande vos disponibilités pour la semaine du ${monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.${deadlineStr ? ` Date limite : ${deadlineStr}.` : ''} Rendez-vous dans « Mes disponibilités ».`,
        link: `/classroom/planning/disponibilites`,
      })),
      skipDuplicates: true,
    });
  }

  return { ...period, _invitedCount: teacherIds.length };
}

export async function listPeriods(user, mentionId) {
  const where = {};
  if (mentionId) where.mentionId = mentionId;

  if (user.systemRole === 'TEACHER') {
    // Teachers see: open periods for mentions they teach in
    // + any period where they already submitted or have a slot (history)
    const mids = await mentionIdsForTeacher(user.sub);
    const orClauses = [
      { availabilities: { some: { teacherUserId: user.sub } } },
      { slots: { some: { teacherUserId: user.sub } } },
    ];
    if (mids.length) {
      orClauses.unshift({
        mentionId: { in: mids },
        status: { in: ['PREPARING', 'BUILDING', 'VALIDATED', 'PUBLISHED'] },
      });
    }
    // If a mentionId filter was supplied, narrow inside OR results
    if (mentionId) {
      where.OR = orClauses.map(c => ({ ...c, mentionId }));
    } else {
      where.OR = orClauses;
    }
  }

  return prisma.schedulePeriod.findMany({
    where,
    include: PERIOD_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPeriod(user, periodId) {
  const period = await prisma.schedulePeriod.findUnique({
    where: { id: periodId },
    include: {
      ...PERIOD_INCLUDE,
      slots: {
        include: {
          teacher:   { select: { id: true, firstName: true, lastName: true } },
          room:      { select: { id: true, name: true, code: true, capacity: true } },
          promotion: { select: { id: true, name: true, level: true } },
          group:     { select: { id: true, name: true } },
          subject:   { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
      },
      availabilities: {
        include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [{ teacherUserId: 'asc' }, { day: 'asc' }, { startTime: 'asc' }],
      },
      preferences: {
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!period) throw new HttpError(404, 'Période non trouvée');

  // Build invited-teacher response tracker
  const invitedIds = await teacherUserIdsForMention(period.mentionId);
  const submittedSet = new Set(period.availabilities.map(a => a.teacherUserId));
  const invitedUsers = invitedIds.length
    ? await prisma.user.findMany({
        where: { id: { in: invitedIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      })
    : [];

  const invitedTeachers = invitedUsers.map(u => ({
    id:               u.id,
    firstName:        u.firstName,
    lastName:         u.lastName,
    email:            u.email,
    hasSubmitted:     submittedSet.has(u.id),
    availabilityCount: period.availabilities.filter(a => a.teacherUserId === u.id).length,
  }));

  const confUsers = period.confirmations.length
    ? await prisma.user.findMany({ where: { id: { in: period.confirmations.map((c) => c.teacherUserId) } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const confirmations = period.confirmations.map((c) => ({ ...c, teacher: confUsers.find((u) => u.id === c.teacherUserId) ?? null }));

  return { ...period, confirmations, invitedTeachers };
}

export async function updatePeriodStatus(user, periodId, status) {
  assertChefOrAdmin(user);
  const period = await prisma.schedulePeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new HttpError(404, 'Période non trouvée');
  return prisma.schedulePeriod.update({ where: { id: periodId }, data: { status }, include: PERIOD_INCLUDE });
}

export async function remindPendingTeachers(user, periodId) {
  assertChefOrAdmin(user);
  const period = await prisma.schedulePeriod.findUnique({
    where: { id: periodId },
    include: { mention: { select: { name: true } } },
  });
  if (!period) throw new HttpError(404, 'Période non trouvée');
  if (period.status !== 'PREPARING') throw new HttpError(400, 'Les relances ne sont possibles qu\'en phase PREPARING');

  const allIds    = await teacherUserIdsForMention(period.mentionId);
  const submitted = await prisma.teacherAvailability.findMany({
    where: { schedulePeriodId: periodId },
    select: { teacherUserId: true },
    distinct: ['teacherUserId'],
  });
  const submittedSet = new Set(submitted.map(s => s.teacherUserId));
  const pendingIds   = allIds.filter(id => !submittedSet.has(id));

  if (!pendingIds.length) return { reminded: 0, message: 'Tous les enseignants ont déjà répondu' };

  const deadlineStr = period.availabilityDeadline
    ? new Date(period.availabilityDeadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
    : null;

  await prisma.notification.createMany({
    data: pendingIds.map(userId => ({
      userId,
      type: 'INFO',
      title: `⏰ Rappel — ${period.name}`,
      body: `Vos disponibilités pour l'emploi du temps de la mention ${period.mention?.name ?? ''} n'ont pas encore été soumises.${deadlineStr ? ` Date limite : ${deadlineStr}.` : ''}`,
      link: `/classroom/planning/disponibilites`,
    })),
    skipDuplicates: false,
  });

  return { reminded: pendingIds.length };
}

// ─── Teacher Availability ─────────────────────────────────────

export async function submitAvailability(user, periodId, slots) {
  if (user.systemRole !== 'TEACHER') throw new HttpError(403, 'Réservé aux enseignants');
  const period = await prisma.schedulePeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new HttpError(404, 'Période non trouvée');
  if (!['PREPARING', 'BUILDING'].includes(period.status)) throw new HttpError(400, 'Cette période n\'accepte plus de disponibilités');
  if (period.availabilityDeadline && new Date() > period.availabilityDeadline) {
    throw new HttpError(400, 'La date limite de soumission est dépassée');
  }

  // Upsert each slot
  await Promise.all(slots.map((s) =>
    prisma.teacherAvailability.upsert({
      where: { schedulePeriodId_teacherUserId_day_startTime: { schedulePeriodId: periodId, teacherUserId: user.sub, day: s.day, startTime: s.startTime } },
      create: { schedulePeriodId: periodId, teacherUserId: user.sub, day: s.day, startTime: s.startTime, endTime: s.endTime, isAvailable: s.isAvailable ?? true, note: s.note ?? null },
      update: { endTime: s.endTime, isAvailable: s.isAvailable ?? true, note: s.note ?? null },
    })
  ));

  return prisma.teacherAvailability.findMany({
    where: { schedulePeriodId: periodId, teacherUserId: user.sub },
    orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
  });
}

export async function getMyAvailability(user, periodId) {
  return prisma.teacherAvailability.findMany({
    where: { schedulePeriodId: periodId, teacherUserId: user.sub },
    orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
  });
}

export async function submitPreference(user, periodId, { courseId, preferredDay, preferredStart, note }) {
  if (user.systemRole !== 'TEACHER') throw new HttpError(403, 'Réservé aux enseignants');
  return prisma.teacherPreference.upsert({
    where: { schedulePeriodId_teacherUserId_courseId: { schedulePeriodId: periodId, teacherUserId: user.sub, courseId } },
    create: { schedulePeriodId: periodId, teacherUserId: user.sub, courseId, preferredDay, preferredStart, note },
    update: { preferredDay, preferredStart, note },
  });
}

// ─── Schedule Building ────────────────────────────────────────

export async function addSlot(user, periodId, input) {
  assertChefOrAdmin(user);
  const period = await prisma.schedulePeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new HttpError(404, 'Période non trouvée');
  if (!['PREPARING', 'BUILDING'].includes(period.status)) throw new HttpError(400, 'Période verrouillée');

  // Validate required FK entities exist before INSERT
  if (input.promotionId) {
    const promo = await prisma.promotion.findUnique({ where: { id: input.promotionId } });
    if (!promo) throw new HttpError(404, 'Promotion introuvable');
  }
  if (input.roomId) {
    const room = await prisma.room.findUnique({ where: { id: input.roomId } });
    if (!room) throw new HttpError(404, 'Salle introuvable');
  }
  if (input.groupId) {
    const grp = await prisma.group.findUnique({ where: { id: input.groupId } });
    if (!grp) throw new HttpError(404, 'Groupe introuvable');
  }
  if (input.subjectId) {
    const sub = await prisma.subject.findUnique({ where: { id: input.subjectId } });
    if (!sub) throw new HttpError(404, 'Matière introuvable');
  }

  const conflicts = await detectConflicts(periodId, input);
  const blocking = conflicts;
  if (blocking.length) {
    const msgs = {
      TEACHER_BUSY:    'Ce professeur a déjà un cours à ce créneau',
      ROOM_BUSY:       'Cette salle est déjà réservée à ce créneau',
      PROMOTION_BUSY:  'Cette promotion a déjà un cours à ce créneau',
      TEACHER_UNAVAILABLE: "Ce professeur n'est pas disponible à ce créneau (il ne l'a pas coché dans ses disponibilités)",
    };
    const msg = blocking.map((c) => msgs[c.type] ?? c.type).join('; ');
    throw new HttpError(409, msg, { conflicts: blocking });
  }

  // Auto-set to BUILDING
  if (period.status === 'PREPARING') {
    await prisma.schedulePeriod.update({ where: { id: periodId }, data: { status: 'BUILDING' } });
  }

  const slot = await prisma.scheduleSlot.create({
    data: {
      schedulePeriodId: periodId,
      subjectId: input.subjectId || null,
      teacherUserId: input.teacherUserId,
      roomId: input.roomId || null,
      promotionId: input.promotionId,
      groupId: input.groupId || null,
      subjectName: input.subjectName,
      day: input.day,
      startTime: input.startTime,
      endTime: input.endTime,
      type: input.type ?? 'CM',
    },
    include: {
      teacher:   { select: { id: true, firstName: true, lastName: true } },
      room:      { select: { id: true, name: true, code: true } },
      promotion: { select: { id: true, name: true } },
      group:     { select: { id: true, name: true } },
      subject:   { select: { id: true, name: true, code: true } },
    },
  });

  // Return slot; if teacher had no declared availability, include a non-blocking warning
  const warnings = conflicts.filter((c) => c.type === 'TEACHER_UNAVAILABLE');
  return { ...slot, _warnings: warnings.length ? ['TEACHER_UNAVAILABLE'] : [] };
}

export async function updateSlot(user, slotId, input) {
  assertChefOrAdmin(user);
  const slot = await prisma.scheduleSlot.findUnique({ where: { id: slotId } });
  if (!slot) throw new HttpError(404, 'Créneau non trouvé');

  const merged = { ...slot, ...input };
  const conflicts = await detectConflicts(slot.schedulePeriodId, { ...merged, excludeSlotId: slotId });
  const blocking = conflicts;
  if (blocking.length) {
    const msgs = { TEACHER_BUSY: 'Professeur déjà occupé', ROOM_BUSY: 'Salle déjà réservée', PROMOTION_BUSY: 'Promotion déjà en cours', TEACHER_UNAVAILABLE: "Professeur non disponible à ce créneau" };
    throw new HttpError(409, blocking.map((c) => msgs[c.type] ?? c.type).join('; '), { conflicts: blocking });
  }

  return prisma.scheduleSlot.update({
    where: { id: slotId },
    data: {
      subjectId:    'subjectId' in input ? (input.subjectId || null) : slot.subjectId,
      teacherUserId: input.teacherUserId ?? slot.teacherUserId,
      roomId:       'roomId' in input ? (input.roomId || null) : slot.roomId,
      promotionId:   input.promotionId  ?? slot.promotionId,
      groupId:      'groupId' in input ? (input.groupId || null) : slot.groupId,
      subjectName:   input.subjectName  ?? slot.subjectName,
      day:           input.day          ?? slot.day,
      startTime:     input.startTime    ?? slot.startTime,
      endTime:       input.endTime      ?? slot.endTime,
      type:          input.type         ?? slot.type,
    },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      room:    { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function deleteSlot(user, slotId) {
  assertChefOrAdmin(user);
  const slot = await prisma.scheduleSlot.findUnique({ where: { id: slotId } });
  if (!slot) throw new HttpError(404, 'Créneau non trouvé');
  await prisma.scheduleSlot.delete({ where: { id: slotId } });
}

export async function checkConflicts(user, periodId, input) {
  return detectConflicts(periodId, input);
}

// ─── Validation & Publication ─────────────────────────────────

export async function validatePeriod(user, periodId, notes) {
  assertChefOrAdmin(user);
  const period = await prisma.schedulePeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new HttpError(404, 'Période non trouvée');
  if (period.status !== 'BUILDING') throw new HttpError(400, 'L\'emploi du temps doit être en construction pour être validé');

  await prisma.$transaction([
    prisma.schedulePeriod.update({ where: { id: periodId }, data: { status: 'VALIDATED' } }),
    prisma.scheduleValidation.upsert({
      where: { schedulePeriodId: periodId },
      create: { schedulePeriodId: periodId, validatedById: user.sub, notes },
      update: { validatedById: user.sub, validatedAt: new Date(), notes },
    }),
  ]);

  return prisma.schedulePeriod.findUnique({ where: { id: periodId }, include: PERIOD_INCLUDE });
}

export async function publishPeriod(user, periodId) {
  assertChefOrAdmin(user);
  const period = await prisma.schedulePeriod.findUnique({
    where: { id: periodId },
    include: { slots: { include: { teacher: { select: { id: true } } } }, mention: true },
  });
  if (!period) throw new HttpError(404, 'Période non trouvée');
  if (period.status !== 'VALIDATED') throw new HttpError(400, 'L\'emploi du temps doit être validé avant publication');

  await prisma.schedulePeriod.update({ where: { id: periodId }, data: { status: 'PUBLISHED', publishedAt: new Date() } });

  // Fan-out notifications
  const teacherIds = [...new Set(period.slots.map((s) => s.teacher.id))];
  const students = await prisma.studentProfile.findMany({
    where: { mentionId: period.mentionId },
    select: { userId: true },
  });
  const parents = await prisma.parentLink.findMany({
    where: { student: { mentionId: period.mentionId } },
    select: { parent: { select: { userId: true } } },
  });

  const notifs = [
    ...teacherIds.map((userId) => ({ userId, type: 'INFO', title: `Emploi du temps ${period.name}`, body: 'Votre emploi du temps est publié.', link: '/classroom/timetable' })),
    ...students.map((s) => ({ userId: s.userId, type: 'INFO', title: `Emploi du temps ${period.mention.name}`, body: `L'emploi du temps ${period.name} est publié.`, link: '/classroom/timetable' })),
    ...parents.map((p) => ({ userId: p.parent.userId, type: 'INFO', title: 'Planning disponible', body: `L'emploi du temps ${period.name} est disponible.`, link: '/classroom/parent' })),
  ];

  if (notifs.length) {
    await prisma.notification.createMany({ data: notifs, skipDuplicates: true });
  }

  return prisma.schedulePeriod.findUnique({ where: { id: periodId }, include: PERIOD_INCLUDE });
}

// ─── Views ────────────────────────────────────────────────────

export async function getMySchedule(user) {
  // Teacher: find published period slots
  if (user.systemRole === 'TEACHER') {
    const slots = await prisma.scheduleSlot.findMany({
      where: { teacherUserId: user.sub, schedulePeriod: { status: 'PUBLISHED' } },
      include: {
        schedulePeriod: { select: { id: true, name: true, weekStart: true, mention: { select: { name: true } }, semester: { select: { name: true } } } },
        room: { select: { id: true, name: true, code: true } },
        promotion: { select: { id: true, name: true, level: true } },
        group: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
    });
    return slots;
  }

  // Student: find via promotion
  if (user.systemRole === 'STUDENT') {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: user.sub }, select: { promotionId: true, groupId: true } });
    if (!profile?.promotionId) return [];
    const slots = await prisma.scheduleSlot.findMany({
      where: {
        promotionId: profile.promotionId,
        schedulePeriod: { status: 'PUBLISHED' },
        OR: [{ groupId: null }, { groupId: profile.groupId }],
      },
      include: {
        schedulePeriod: { select: { id: true, name: true, weekStart: true, mention: { select: { name: true } }, semester: { select: { name: true } } } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        promotion: { select: { id: true, name: true, level: true } },
        room: { select: { id: true, name: true, code: true } },
        subject: { select: { id: true, name: true, code: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
    });
    return slots;
  }

  return [];
}

export async function getPeriodView(periodId) {
  return prisma.schedulePeriod.findUnique({
    where: { id: periodId },
    include: {
      mention: { select: { name: true, code: true } },
      semester: { select: { name: true, number: true } },
      slots: {
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true } },
          room: { select: { id: true, name: true, code: true } },
          promotion: { select: { id: true, name: true, level: true } },
          group: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
      },
    },
  });
}

// Resources for schedule builder
export async function getBuilderResources(user, mentionId) {
  const [teachers, rooms, promotions, subjects] = await Promise.all([
    // All active teachers with their TeacherProfile for display
    prisma.user.findMany({
      where: { systemRole: 'TEACHER', isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { lastName: 'asc' },
    }),
    prisma.room.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, capacity: true, type: true },
      orderBy: { name: 'asc' },
    }),
    prisma.promotion.findMany({
      where: mentionId ? { mentionId } : {},
      select: { id: true, name: true, level: true, groups: { select: { id: true, name: true, type: true } } },
    }),
    // ERP subjects linked to the mention
    prisma.subject.findMany({
      where: mentionId ? { mentionId, isActive: true } : { isActive: true },
      select: {
        id: true, code: true, name: true, credits: true, weeklyHours: true,
        subjectTeachers: {
          select: {
            type: true,
            teacher: { select: { user: { select: { id: true, firstName: true, lastName: true } } } },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);
  return { teachers, rooms, promotions, subjects };
}


// ─── Envoi aux enseignants et validation de leur emploi du temps ─────────────

// Le Responsable Pédagogique envoie à chaque enseignant concerné les créneaux
// qu'il lui a attribués ; chaque enseignant doit valider (ou signaler un problème).
export async function sendToTeachers(user, periodId) {
  assertChefOrAdmin(user);
  const period = await prisma.schedulePeriod.findUnique({
    where: { id: periodId },
    include: { slots: { select: { teacherUserId: true } }, mention: { select: { name: true } } },
  });
  if (!period) throw new HttpError(404, 'Période non trouvée');
  if (!['BUILDING', 'VALIDATED'].includes(period.status)) throw new HttpError(400, "Construisez d'abord l'emploi du temps");
  const teacherIds = [...new Set(period.slots.map((s) => s.teacherUserId))];
  if (!teacherIds.length) throw new HttpError(400, 'Aucun créneau à envoyer');

  for (const teacherUserId of teacherIds) {
    await prisma.scheduleTeacherConfirmation.upsert({
      where: { schedulePeriodId_teacherUserId: { schedulePeriodId: periodId, teacherUserId } },
      create: { schedulePeriodId: periodId, teacherUserId },
      update: { status: 'PENDING', comment: null, respondedAt: null, sentAt: new Date() },
    });
  }
  // Les enseignants retirés de l'emploi du temps n'ont plus rien à valider
  await prisma.scheduleTeacherConfirmation.deleteMany({ where: { schedulePeriodId: periodId, teacherUserId: { notIn: teacherIds } } });
  await prisma.schedulePeriod.update({ where: { id: periodId }, data: { sentToTeachersAt: new Date() } });
  await prisma.notification.createMany({
    data: teacherIds.map((userId) => ({
      userId, type: 'INFO',
      title: `🗓️ Emploi du temps à valider — ${period.name}`,
      body: `Le Responsable Pédagogique (${period.mention?.name ?? ''}) vous a envoyé vos créneaux. Merci de les valider.`,
      link: '/classroom/planning/disponibilites',
    })),
  });
  return getPeriod(user, periodId);
}

// Créneaux de l'enseignant pour une période + état de sa validation
export async function myPeriodSlots(user, periodId) {
  const [slots, confirmation] = await Promise.all([
    prisma.scheduleSlot.findMany({
      where: { schedulePeriodId: periodId, teacherUserId: user.sub },
      include: {
        room: { select: { name: true, code: true } },
        promotion: { select: { name: true, level: true } },
        group: { select: { name: true } },
      },
      orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
    }),
    prisma.scheduleTeacherConfirmation.findUnique({
      where: { schedulePeriodId_teacherUserId: { schedulePeriodId: periodId, teacherUserId: user.sub } },
    }),
  ]);
  return { slots, confirmation };
}

export async function respondToSchedule(user, periodId, { status, comment }) {
  if (user.systemRole !== 'TEACHER') throw new HttpError(403, 'Réservé aux enseignants');
  if (!['ACCEPTED', 'CONTESTED'].includes(status)) throw new HttpError(400, 'Statut invalide');
  if (status === 'CONTESTED' && !comment?.trim()) throw new HttpError(400, 'Expliquez le problème au Responsable Pédagogique');
  const conf = await prisma.scheduleTeacherConfirmation.findUnique({
    where: { schedulePeriodId_teacherUserId: { schedulePeriodId: periodId, teacherUserId: user.sub } },
    include: { schedulePeriod: { select: { name: true, createdById: true } } },
  });
  if (!conf) throw new HttpError(404, "Aucun emploi du temps ne vous a été envoyé pour cette période");
  const updated = await prisma.scheduleTeacherConfirmation.update({
    where: { id: conf.id },
    data: { status, comment: comment?.trim() || null, respondedAt: new Date() },
  });
  const me = await prisma.user.findUnique({ where: { id: user.sub }, select: { firstName: true, lastName: true } });
  await prisma.notification.create({
    data: {
      userId: conf.schedulePeriod.createdById,
      type: status === 'ACCEPTED' ? 'SUCCESS' : 'WARNING',
      title: status === 'ACCEPTED'
        ? `✅ ${me.firstName} ${me.lastName} a validé son emploi du temps`
        : `⚠️ ${me.firstName} ${me.lastName} signale un problème`,
      body: `${conf.schedulePeriod.name}${comment ? ` — « ${comment} »` : ''}`,
      link: `/classroom/planning/${periodId}`,
    },
  });
  return updated;
}

export { DAY_LABELS };
