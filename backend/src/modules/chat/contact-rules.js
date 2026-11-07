// Règles de messagerie ERP — qui peut écrire à qui.
//
//   Étudiant      → camarades de sa promotion, ses enseignants attitrés,
//                   le secrétariat, le Responsable Pédagogique de sa mention
//   Parent        → enseignants attitrés de ses enfants, le secrétariat,
//                   le Responsable Pédagogique de la mention de ses enfants
//   Enseignant    → ses élèves (et leurs parents), le Responsable Pédagogique
//                   de son domaine, le personnel administratif
//   Secrétaire    → étudiants, parents, Responsables Pédagogiques, personnel
//   Resp. Péda.   → étudiants et parents de sa mention, enseignants de son
//                   domaine, personnel
//   Comptabilité  → personnel uniquement (staff + enseignants)
//   Super Admin   → tout le monde
//
// La relation est rendue symétrique : si A peut écrire à B, B peut répondre à A.
import { prisma } from '../../database/prisma.js';
import { isMentionResponsible, PRESENCE_ROLE } from '../../utils/roles.js';

const SECRETARY = (n = '') => n.includes('Secrétaire') || n.includes('Administration');
const FINANCE = (n = '') => n.includes('Comptabilité') || n.includes('Trésorier') || n.includes('Finance');

async function loadMe(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, systemRole: true,
      userRoles: { select: { mentionId: true, role: { select: { name: true } } } },
      studentProfile: { select: { id: true, promotionId: true, mentionId: true, promotion: { select: { level: true } } } },
      teacherProfile: { select: { id: true, mentionId: true } },
      parentProfile: {
        select: { parentLinks: { select: { student: { select: { id: true, promotionId: true, mentionId: true, promotion: { select: { level: true } } } } } } },
      },
    },
  });
}

// Enseignants attitrés d'une promotion : CourseTeacher, créneaux d'emploi du temps
// et plan de cursus (mention + niveau).
async function teachersOfPromotions(promos) {
  const ids = new Set();
  const promIds = promos.map((p) => p.promotionId).filter(Boolean);
  if (!promIds.length) return ids;
  const [cts, slots, cursus] = await Promise.all([
    prisma.courseTeacher.findMany({ where: { course: { promotionId: { in: promIds } } }, select: { teacher: { select: { userId: true } } } }),
    prisma.scheduleSlot.findMany({ where: { promotionId: { in: promIds } }, select: { teacherUserId: true }, distinct: ['teacherUserId'] }),
    prisma.curriculumEntry.findMany({
      where: { OR: promos.filter((p) => p.mentionId && p.level).map((p) => ({ mentionId: p.mentionId, level: p.level })), teacherId: { not: null } },
      select: { teacherId: true },
    }),
  ]);
  cts.forEach((c) => c.teacher?.userId && ids.add(c.teacher.userId));
  slots.forEach((s) => ids.add(s.teacherUserId));
  cursus.forEach((c) => ids.add(c.teacherId));
  return ids;
}

// Promotions (avec mention / niveau) où enseigne un enseignant
async function promotionsOfTeacher(teacherUserId, teacherProfileId) {
  const [cts, slots, cursus] = await Promise.all([
    teacherProfileId
      ? prisma.courseTeacher.findMany({ where: { teacherId: teacherProfileId }, select: { course: { select: { promotionId: true } } } })
      : [],
    prisma.scheduleSlot.findMany({ where: { teacherUserId }, select: { promotionId: true }, distinct: ['promotionId'] }),
    prisma.curriculumEntry.findMany({ where: { teacherId: teacherUserId }, select: { mentionId: true, level: true } }),
  ]);
  const promIds = new Set([...cts.map((c) => c.course.promotionId), ...slots.map((s) => s.promotionId)]);
  const or = [{ id: { in: [...promIds] } }, ...cursus.map((c) => ({ mentionId: c.mentionId, level: c.level }))];
  return prisma.promotion.findMany({ where: { OR: or }, select: { id: true, mentionId: true } });
}

async function usersWithRole(predicate, mentionIds = null) {
  const rows = await prisma.userRole.findMany({
    select: { userId: true, mentionId: true, role: { select: { name: true } }, user: { select: { isActive: true } } },
  });
  return rows
    .filter((r) => r.user.isActive && predicate(r.role.name))
    .filter((r) => !mentionIds || (r.mentionId && mentionIds.includes(r.mentionId)))
    .map((r) => r.userId);
}

const isRP = (n) => isMentionResponsible(n) && n !== PRESENCE_ROLE;

async function staffIds() {
  const rows = await prisma.user.findMany({ where: { systemRole: { in: ['STAFF', 'SUPER_ADMIN'] }, isActive: true }, select: { id: true } });
  return rows.map((r) => r.id);
}

async function studentsAndParentsOfMentions(mentionIds, promotionIds = null) {
  const where = promotionIds ? { promotionId: { in: promotionIds } } : { mentionId: { in: mentionIds } };
  const students = await prisma.studentProfile.findMany({
    where,
    select: { userId: true, parentLinks: { select: { parent: { select: { userId: true } } } } },
  });
  const ids = [];
  students.forEach((s) => {
    ids.push(s.userId);
    s.parentLinks.forEach((l) => ids.push(l.parent.userId));
  });
  return ids;
}

// Contacts autorisés « sortants » (règles vues depuis l'utilisateur)
async function outgoing(me) {
  const ids = new Set();
  const add = (arr) => arr.forEach((id) => id && ids.add(id));
  const roleNames = me.userRoles.map((r) => r.role.name);

  if (me.systemRole === 'SUPER_ADMIN') {
    const all = await prisma.user.findMany({
      where: { isActive: true, systemRole: { notIn: ['CANDIDATE', 'STUDENT_ONLINE', 'TEACHER_ONLINE'] } },
      select: { id: true },
    });
    add(all.map((u) => u.id));
    return ids;
  }

  if (me.systemRole === 'STUDENT' && me.studentProfile) {
    const sp = me.studentProfile;
    if (sp.promotionId) {
      const peers = await prisma.studentProfile.findMany({ where: { promotionId: sp.promotionId }, select: { userId: true } });
      add(peers.map((p) => p.userId));
    }
    add([...await teachersOfPromotions([{ promotionId: sp.promotionId, mentionId: sp.mentionId, level: sp.promotion?.level }])]);
    add(await usersWithRole(SECRETARY));
    if (sp.mentionId) add(await usersWithRole(isRP, [sp.mentionId]));
    return ids;
  }

  if (me.systemRole === 'PARENT' && me.parentProfile) {
    const kids = me.parentProfile.parentLinks.map((l) => l.student);
    add([...await teachersOfPromotions(kids.map((k) => ({ promotionId: k.promotionId, mentionId: k.mentionId, level: k.promotion?.level })))]);
    add(await usersWithRole(SECRETARY));
    const mentionIds = [...new Set(kids.map((k) => k.mentionId).filter(Boolean))];
    if (mentionIds.length) add(await usersWithRole(isRP, mentionIds));
    return ids;
  }

  if (me.systemRole === 'TEACHER') {
    const promos = await promotionsOfTeacher(me.id, me.teacherProfile?.id);
    if (promos.length) add(await studentsAndParentsOfMentions(null, promos.map((p) => p.id)));
    const mentionIds = [...new Set([me.teacherProfile?.mentionId, ...promos.map((p) => p.mentionId)].filter(Boolean))];
    if (mentionIds.length) add(await usersWithRole(isRP, mentionIds));
    add(await usersWithRole((n) => SECRETARY(n) || FINANCE(n)));
    const admins = await prisma.user.findMany({ where: { systemRole: 'SUPER_ADMIN', isActive: true }, select: { id: true } });
    add(admins.map((a) => a.id));
    return ids;
  }

  // STAFF — dépend du rôle
  if (roleNames.some(FINANCE)) {
    add(await staffIds());
    const teachers = await prisma.user.findMany({ where: { systemRole: 'TEACHER', isActive: true }, select: { id: true } });
    add(teachers.map((t) => t.id));
  }
  if (roleNames.some(SECRETARY)) {
    const people = await prisma.user.findMany({
      where: { systemRole: { in: ['STUDENT', 'PARENT', 'STAFF', 'SUPER_ADMIN', 'TEACHER'] }, isActive: true },
      select: { id: true },
    });
    add(people.map((p) => p.id));
  }
  const rpMentions = me.userRoles.filter((r) => isRP(r.role.name)).map((r) => r.mentionId).filter(Boolean);
  if (rpMentions.length || roleNames.some(isRP)) {
    if (rpMentions.length) {
      add(await studentsAndParentsOfMentions(rpMentions));
      const teachers = await prisma.teacherProfile.findMany({ where: { mentionId: { in: rpMentions } }, select: { userId: true } });
      add(teachers.map((t) => t.userId));
      const cursusTeachers = await prisma.curriculumEntry.findMany({ where: { mentionId: { in: rpMentions }, teacherId: { not: null } }, select: { teacherId: true } });
      add(cursusTeachers.map((c) => c.teacherId));
    }
    add(await staffIds());
  }
  if (roleNames.includes(PRESENCE_ROLE)) add(await staffIds());
  if (!roleNames.length) add(await staffIds());
  return ids;
}

// Contacts autorisés, en rendant la relation symétrique
export async function allowedContactIds(userId) {
  const me = await loadMe(userId);
  if (!me) return new Set();
  const ids = await outgoing(me);

  // Symétrie : les personnes qui ont le droit de m'écrire peuvent recevoir ma réponse.
  // On ne vérifie que les profils pour lesquels la règle n'est pas déjà large.
  if (me.systemRole === 'TEACHER' || me.systemRole === 'STAFF') {
    // Les comptables peuvent écrire à tout le personnel / enseignants
    add(ids, await usersWithRole(FINANCE));
    add(ids, await usersWithRole(SECRETARY));
  }
  const admins = await prisma.user.findMany({ where: { systemRole: 'SUPER_ADMIN', isActive: true }, select: { id: true } });
  if (me.systemRole !== 'STUDENT' && me.systemRole !== 'PARENT') add(ids, admins.map((a) => a.id));

  ids.delete(userId);
  return ids;
}

function add(set, arr) { arr.forEach((id) => id && set.add(id)); }

export async function canContact(userId, otherUserId) {
  const ids = await allowedContactIds(userId);
  if (ids.has(otherUserId)) return true;
  // Symétrie stricte : si l'autre peut m'écrire, je peux lui répondre
  const theirs = await allowedContactIds(otherUserId);
  return theirs.has(userId);
}
