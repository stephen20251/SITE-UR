import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { isMentionResponsible } from '../../utils/roles.js';

// ─── Qui peut publier pour qui ───────────────────────────────
//  Super Admin / personnel : tout public
//  Responsable Pédagogique : sa mention (ou une promotion de sa mention)
//  Enseignant : uniquement les étudiants / parents des classes où il enseigne
async function teacherPromotionIds(userId) {
  const [slots, cts, cursus] = await Promise.all([
    prisma.scheduleSlot.findMany({ where: { teacherUserId: userId }, select: { promotionId: true }, distinct: ['promotionId'] }),
    prisma.courseTeacher.findMany({ where: { teacher: { userId } }, select: { course: { select: { promotionId: true } } } }),
    prisma.curriculumEntry.findMany({ where: { teacherId: userId }, select: { mentionId: true, level: true } }),
  ]);
  const ids = new Set([...slots.map((s) => s.promotionId), ...cts.map((c) => c.course.promotionId)]);
  if (cursus.length) {
    const promos = await prisma.promotion.findMany({
      where: { OR: cursus.map((c) => ({ mentionId: c.mentionId, level: c.level })) }, select: { id: true },
    });
    promos.forEach((p) => ids.add(p.id));
  }
  return [...ids];
}

async function rpMentionIds(userId) {
  const urs = await prisma.userRole.findMany({ where: { userId }, select: { mentionId: true, role: { select: { name: true } } } });
  return urs.filter((u) => isMentionResponsible(u.role.name) && u.mentionId).map((u) => u.mentionId);
}

// Publics proposés dans le formulaire de publication
export async function audiences(user) {
  const promoSelect = { id: true, name: true, level: true, mentionId: true };
  if (user.systemRole === 'TEACHER') {
    const ids = await teacherPromotionIds(user.sub);
    return {
      canTargetAll: false, roles: ['STUDENT', 'PARENT'], mentions: [],
      promotions: await prisma.promotion.findMany({ where: { id: { in: ids } }, select: promoSelect, orderBy: { name: 'asc' } }),
    };
  }
  const mentionIds = user.systemRole === 'STAFF' ? await rpMentionIds(user.sub) : [];
  if (mentionIds.length) {
    return {
      canTargetAll: false, roles: ['STUDENT', 'PARENT', 'TEACHER'],
      mentions: await prisma.mention.findMany({ where: { id: { in: mentionIds } }, select: { id: true, name: true } }),
      promotions: await prisma.promotion.findMany({ where: { mentionId: { in: mentionIds } }, select: promoSelect, orderBy: { name: 'asc' } }),
    };
  }
  if (['SUPER_ADMIN', 'STAFF'].includes(user.systemRole)) {
    return {
      canTargetAll: true, roles: ['STUDENT', 'PARENT', 'TEACHER', 'STAFF'],
      mentions: await prisma.mention.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      promotions: await prisma.promotion.findMany({ select: promoSelect, orderBy: { name: 'asc' } }),
    };
  }
  return { canTargetAll: false, roles: [], mentions: [], promotions: [] };
}

// Vérifie / ajuste le ciblage selon le rôle de l'auteur
async function enforceTargeting(user, input) {
  if (!input.title?.trim() || !input.content?.trim()) throw new HttpError(400, 'Titre et contenu requis');
  const roles = input.targetRoles ?? [];
  if (user.systemRole === 'TEACHER') {
    const allowed = await teacherPromotionIds(user.sub);
    if (!input.promotionId || !allowed.includes(input.promotionId)) {
      throw new HttpError(403, 'Choisissez une de vos classes : un enseignant publie uniquement pour ses élèves et leurs parents');
    }
    const r = roles.filter((x) => ['STUDENT', 'PARENT'].includes(x));
    return { ...input, targetAll: false, targetUserId: null, mentionId: null, targetRoles: r.length ? r : ['STUDENT'] };
  }
  if (user.systemRole === 'STAFF') {
    const mentionIds = await rpMentionIds(user.sub);
    if (mentionIds.length) {
      if (input.promotionId) {
        const p = await prisma.promotion.findUnique({ where: { id: input.promotionId }, select: { mentionId: true } });
        if (!p || !mentionIds.includes(p.mentionId)) throw new HttpError(403, 'Cette promotion ne fait pas partie de votre mention');
      }
      const mentionId = input.mentionId && mentionIds.includes(input.mentionId) ? input.mentionId : mentionIds[0];
      return { ...input, targetAll: false, mentionId };
    }
    return input;
  }
  if (user.systemRole === 'SUPER_ADMIN') return input;
  throw new HttpError(403, "Vous n'êtes pas autorisé à publier des annonces");
}

const AUTHOR_SELECT = {
  select: { id: true, firstName: true, lastName: true, systemRole: true, avatarUrl: true },
};

const FULL_INCLUDE = {
  author: AUTHOR_SELECT,
  mention: { select: { id: true, name: true, code: true } },
  promotion: { select: { id: true, name: true, level: true } },
  attachments: true,
  _count: { select: { reads: true, comments: true } },
};

// ─── Helpers ─────────────────────────────────────────────────

// Destinataires d'une annonce — même logique que audienceWhere() :
// tous les critères renseignés doivent correspondre.
async function resolveRecipientIds(input) {
  if (input.targetUserId) return [input.targetUserId];
  const hasTarget = input.targetAll || input.targetRoles?.length || input.mentionId || input.promotionId;
  if (!hasTarget) return [];

  const and = [{ isActive: true }];
  if (input.targetRoles?.length) and.push({ systemRole: { in: input.targetRoles } });
  if (input.mentionId) {
    const m = input.mentionId;
    and.push({ OR: [
      { studentProfile: { mentionId: m } },
      { teacherProfile: { mentionId: m } },
      { userRoles: { some: { mentionId: m } } },
      { parentProfile: { parentLinks: { some: { student: { mentionId: m } } } } },
    ] });
  }
  if (input.promotionId) {
    const p = input.promotionId;
    and.push({ OR: [
      { studentProfile: { promotionId: p } },
      { scheduleSlots: { some: { promotionId: p } } },
      { parentProfile: { parentLinks: { some: { student: { promotionId: p } } } } },
    ] });
  }
  const users = await prisma.user.findMany({ where: { AND: and }, select: { id: true } });
  return users.map((u) => u.id);
}

// ─── CRUD ─────────────────────────────────────────────────────

export async function create(user, rawInput) {
  const input = await enforceTargeting(user, rawInput);
  if (!input.targetAll && !input.targetRoles?.length && !input.mentionId && !input.promotionId && !input.targetUserId) {
    throw new HttpError(400, 'Choisissez au moins un public cible');
  }

  const status = input.status ?? (input.publishAt && new Date(input.publishAt) > new Date() ? 'SCHEDULED' : 'PUBLISHED');

  const announcement = await prisma.announcement.create({
    data: {
      authorId: user.sub,
      title: input.title,
      content: input.content,
      category: input.category ?? 'GENERAL',
      priority: input.priority ?? 'NORMAL',
      status,
      channels: input.channels ?? ['DASHBOARD', 'NOTIFICATION'],
      isPinned: input.isPinned ?? false,
      publishAt: input.publishAt ? new Date(input.publishAt) : new Date(),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      targetAll: input.targetAll ?? false,
      targetRoles: input.targetRoles ?? [],
      mentionId: input.mentionId ?? null,
      promotionId: input.promotionId ?? null,
      targetUserId: input.targetUserId ?? null,
      attachments: input.attachments?.length
        ? { create: input.attachments }
        : undefined,
    },
    include: FULL_INCLUDE,
  });

  // Fan-out notifications if published now
  if (status === 'PUBLISHED' && input.channels?.includes('NOTIFICATION') !== false) {
    fanOutNotifications(user.sub, announcement, input).catch(() => {});
  }

  return announcement;
}

async function fanOutNotifications(authorId, announcement, input) {
  const recipientIds = await resolveRecipientIds(input);
  const filtered = recipientIds.filter((id) => id !== authorId);
  if (!filtered.length) return;

  await prisma.notification.createMany({
    data: filtered.map((userId) => ({
      userId,
      type: 'ANNOUNCEMENT',
      title: announcement.title,
      body: announcement.content.slice(0, 140),
      link: `/classroom/announcements`,
    })),
    skipDuplicates: true,
  });
}

// Audience d'un utilisateur : ses mentions / promotions (celles de ses enfants pour un parent)
async function audienceOf(user) {
  const u = await prisma.user.findUnique({
    where: { id: user.sub },
    select: {
      systemRole: true,
      studentProfile: { select: { mentionId: true, promotionId: true } },
      teacherProfile: { select: { mentionId: true } },
      parentProfile: { select: { parentLinks: { select: { student: { select: { mentionId: true, promotionId: true } } } } } },
      userRoles: { select: { mentionId: true } },
    },
  });
  const mentionIds = new Set();
  const promotionIds = new Set();
  const addP = (p) => { if (p?.mentionId) mentionIds.add(p.mentionId); if (p?.promotionId) promotionIds.add(p.promotionId); };
  addP(u?.studentProfile);
  addP(u?.teacherProfile);
  u?.parentProfile?.parentLinks.forEach((l) => addP(l.student));
  u?.userRoles.forEach((r) => addP(r));
  if (u?.systemRole === 'TEACHER') {
    const slots = await prisma.scheduleSlot.findMany({ where: { teacherUserId: user.sub }, select: { promotionId: true }, distinct: ['promotionId'] });
    slots.forEach((s) => promotionIds.add(s.promotionId));
  }
  return { systemRole: u?.systemRole ?? user.systemRole, mentionIds: [...mentionIds], promotionIds: [...promotionIds] };
}

// Une annonce concerne l'utilisateur si elle lui est adressée nominativement, ou si
// TOUS les critères de ciblage renseignés (rôles, mention, promotion) lui correspondent.
// Une annonce sans aucun ciblage n'est visible que par l'administration.
// Les rôles ciblés sont une liste JSON (MySQL) : ce critère est vérifié ici, en JavaScript.
async function audienceWhere(user) {
  const a = await audienceOf(user);
  const targeted = await prisma.announcement.findMany({
    where: {
      targetUserId: null,
      AND: [
        { OR: [{ mentionId: null }, { mentionId: { in: a.mentionIds } }] },
        { OR: [{ promotionId: null }, { promotionId: { in: a.promotionIds } }] },
      ],
    },
    select: { id: true, targetAll: true, targetRoles: true, mentionId: true, promotionId: true },
  });
  const ids = targeted
    .filter((ann) => {
      const roles = Array.isArray(ann.targetRoles) ? ann.targetRoles : [];
      const hasTarget = ann.targetAll || roles.length > 0 || ann.mentionId || ann.promotionId;
      return hasTarget && (roles.length === 0 || roles.includes(a.systemRole));
    })
    .map((ann) => ann.id);
  return { OR: [{ targetUserId: user.sub }, { id: { in: ids } }] };
}

export async function list(user, { status, category, page = 1, limit = 20 } = {}) {
  const isAdmin = user.systemRole === 'SUPER_ADMIN';

  const where = {};
  if (user.systemRole === 'STAFF' || user.systemRole === 'TEACHER') {
    where.OR = [{ authorId: user.sub }, { status: 'PUBLISHED', ...(await audienceWhere(user)) }];
  } else if (!isAdmin) {
    // Non-admins see only PUBLISHED announcements that concern them
    where.status = 'PUBLISHED';
    Object.assign(where, await audienceWhere(user));
  } else {
    if (status) where.status = status;
    if (category) where.category = category;
  }

  const [total, items] = await Promise.all([
    prisma.announcement.count({ where }),
    prisma.announcement.findMany({
      where,
      include: {
        ...FULL_INCLUDE,
        reads: { where: { userId: user.sub }, select: { seenAt: true, readAt: true, confirmedAt: true } },
      },
      orderBy: [{ isPinned: 'desc' }, { publishAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { total, page, limit, items };
}

export async function getById(user, id) {
  const ann = await prisma.announcement.findUnique({
    where: { id },
    include: {
      ...FULL_INCLUDE,
      reads: { include: { user: AUTHOR_SELECT }, orderBy: { seenAt: 'desc' } },
      comments: { include: { author: AUTHOR_SELECT }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!ann) throw new HttpError(404, 'Announcement not found');
  if (!['SUPER_ADMIN', 'STAFF'].includes(user.systemRole) && ann.authorId !== user.sub) {
    const visible = await prisma.announcement.count({ where: { id, status: 'PUBLISHED', ...(await audienceWhere(user)) } });
    if (!visible) throw new HttpError(404, 'Announcement not found');
  }

  // Mark as seen
  await prisma.announcementRead.upsert({
    where: { announcementId_userId: { announcementId: id, userId: user.sub } },
    create: { announcementId: id, userId: user.sub, seenAt: new Date() },
    update: { seenAt: new Date() },
  });

  return ann;
}

export async function update(user, id, input) {
  const ann = await prisma.announcement.findUnique({ where: { id } });
  if (!ann) throw new HttpError(404, 'Announcement not found');
  const isAdmin = ['SUPER_ADMIN', 'STAFF'].includes(user.systemRole);
  if (ann.authorId !== user.sub && !isAdmin) throw new HttpError(403, 'Forbidden');

  return prisma.announcement.update({
    where: { id },
    data: {
      title: input.title ?? ann.title,
      content: input.content ?? ann.content,
      category: input.category ?? ann.category,
      priority: input.priority ?? ann.priority,
      status: input.status ?? ann.status,
      channels: input.channels ?? ann.channels,
      isPinned: input.isPinned ?? ann.isPinned,
      publishAt: input.publishAt ? new Date(input.publishAt) : ann.publishAt,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : ann.expiresAt,
      targetAll: input.targetAll ?? ann.targetAll,
      targetRoles: input.targetRoles ?? ann.targetRoles,
      mentionId: 'mentionId' in input ? input.mentionId : ann.mentionId,
      promotionId: 'promotionId' in input ? input.promotionId : ann.promotionId,
      targetUserId: 'targetUserId' in input ? input.targetUserId : ann.targetUserId,
    },
    include: FULL_INCLUDE,
  });
}

export async function remove(user, id) {
  const ann = await prisma.announcement.findUnique({ where: { id } });
  if (!ann) throw new HttpError(404, 'Annonce introuvable');
  if (ann.authorId !== user.sub && user.systemRole !== 'SUPER_ADMIN') {
    throw new HttpError(403, "Seul l'auteur ou le Super Admin peut supprimer cette annonce");
  }
  await prisma.notification.deleteMany({ where: { type: 'ANNOUNCEMENT', title: ann.title, createdAt: { gte: ann.createdAt } } });
  await prisma.announcement.delete({ where: { id } });
}

// ─── Read tracking ─────────────────────────────────────────────

export async function markRead(user, id) {
  await prisma.announcementRead.upsert({
    where: { announcementId_userId: { announcementId: id, userId: user.sub } },
    create: { announcementId: id, userId: user.sub, seenAt: new Date(), readAt: new Date() },
    update: { readAt: new Date() },
  });
}

export async function markConfirmed(user, id) {
  await prisma.announcementRead.upsert({
    where: { announcementId_userId: { announcementId: id, userId: user.sub } },
    create: { announcementId: id, userId: user.sub, seenAt: new Date(), readAt: new Date(), confirmedAt: new Date() },
    update: { confirmedAt: new Date() },
  });
}

// ─── Comments ──────────────────────────────────────────────────

export async function addComment(user, id, content) {
  const ann = await prisma.announcement.findUnique({ where: { id } });
  if (!ann) throw new HttpError(404, 'Announcement not found');
  return prisma.announcementComment.create({
    data: { announcementId: id, authorId: user.sub, content },
    include: { author: AUTHOR_SELECT },
  });
}

export async function deleteComment(user, commentId) {
  const c = await prisma.announcementComment.findUnique({ where: { id: commentId } });
  if (!c) throw new HttpError(404, 'Comment not found');
  const isAdmin = ['SUPER_ADMIN', 'STAFF'].includes(user.systemRole);
  if (c.authorId !== user.sub && !isAdmin) throw new HttpError(403, 'Forbidden');
  await prisma.announcementComment.delete({ where: { id: commentId } });
}

// ─── Stats ─────────────────────────────────────────────────────

export async function stats(user, id) {
  const ann = await prisma.announcement.findUnique({ where: { id } });
  if (!ann) throw new HttpError(404, 'Announcement not found');
  const isAdmin = ['SUPER_ADMIN', 'STAFF'].includes(user.systemRole);
  if (ann.authorId !== user.sub && !isAdmin) throw new HttpError(403, 'Forbidden');

  const [reads, comments, attachmentDownloads] = await Promise.all([
    prisma.announcementRead.findMany({
      where: { announcementId: id },
      include: { user: AUTHOR_SELECT },
    }),
    prisma.announcementComment.count({ where: { announcementId: id } }),
    Promise.resolve(0), // placeholder — real downloads need file-access logs
  ]);

  // Estimate total recipients
  const recipientIds = await resolveRecipientIds({
    targetAll: ann.targetAll,
    targetRoles: ann.targetRoles,
    mentionId: ann.mentionId,
    promotionId: ann.promotionId,
    targetUserId: ann.targetUserId,
  });

  const seen = reads.filter((r) => r.seenAt).length;
  const read = reads.filter((r) => r.readAt).length;
  const confirmed = reads.filter((r) => r.confirmedAt).length;
  const total = recipientIds.length || 1;

  return {
    totalRecipients: total,
    seen,
    read,
    confirmed,
    unread: Math.max(0, total - seen),
    readRate: Math.round((read / total) * 100),
    comments,
    attachmentDownloads,
    readers: reads.map((r) => ({
      user: r.user,
      seenAt: r.seenAt,
      readAt: r.readAt,
      confirmedAt: r.confirmedAt,
    })),
  };
}
