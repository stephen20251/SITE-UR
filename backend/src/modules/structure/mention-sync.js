// Rattachement des comptes à leur mention (exécuté au démarrage, idempotent).
//  1. Un Responsable pédagogique sans mention est rattaché à celle que désigne le
//     nom de son rôle : « Responsable Gestion » → Gestion, « Responsable Info » → Informatique.
//  2. Les Responsables reçoivent les droits sur les candidatures (consulter, examiner,
//     accepter, inscrire) : ils gèrent les adhésions de LEUR mention.
//  3. Un enseignant sans mention est rattaché à la mention de ses matières quand
//     elles appartiennent toutes à une seule mention.
import { prisma } from '../../database/prisma.js';
import { isMentionScopedRole } from '../../middlewares/rbac.js';

export const RP_CANDIDATE_PERMS = ['VIEW_CANDIDATES', 'REVIEW_CANDIDATE', 'ACCEPT_CANDIDATE', 'ENROLL_STUDENT', 'GENERATE_MATRICULE'];

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STOP = new Set(['responsable', 'pedagogique', 'pedagogie', 'de', 'la', 'du', 'des', 'mention', 'rp', 'chef', 'et', '-', '/']);

// Mention désignée par un nom de rôle (une seule correspondance, sinon null).
export function mentionFromRoleName(roleName, mentions) {
  const words = norm(roleName).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
  if (!words.length) return null;
  const hits = mentions.filter((m) => {
    const name = norm(m.name);
    const code = norm(m.code).replace(/^m-/, '');
    return words.some((w) => name.startsWith(w) || name.split(/\s+/).some((t) => t.startsWith(w)) || code === w || code.startsWith(w));
  });
  return hits.length === 1 ? hits[0] : null;
}

export async function syncMentionLinks() {
  const mentions = await prisma.mention.findMany({ select: { id: true, name: true, code: true } });
  let rolesLinked = 0;
  let teachersLinked = 0;
  let permsAdded = 0;

  // 1. Responsables sans mention
  const rpRoles = (await prisma.role.findMany({ select: { id: true, name: true } })).filter((r) => isMentionScopedRole(r.name));
  for (const role of rpRoles) {
    const mention = mentionFromRoleName(role.name, mentions);
    if (!mention) continue;
    const r = await prisma.userRole.updateMany({ where: { roleId: role.id, mentionId: null }, data: { mentionId: mention.id } });
    rolesLinked += r.count;
  }

  // 2. Droits sur les candidatures pour les rôles de Responsable
  const perms = await prisma.permission.findMany({ where: { code: { in: RP_CANDIDATE_PERMS } }, select: { id: true } });
  for (const role of rpRoles) {
    for (const p of perms) {
      const exists = await prisma.rolePermission.findFirst({ where: { roleId: role.id, permissionId: p.id }, select: { roleId: true } });
      if (!exists) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }).catch(() => {});
        permsAdded += 1;
      }
    }
  }

  // 3. Enseignants sans mention
  const loose = await prisma.teacherProfile.findMany({
    where: { mentionId: null },
    select: { id: true, userId: true, subjectTeachers: { select: { subject: { select: { mentionId: true } } } } },
  });
  for (const t of loose) {
    const fromSubjects = t.subjectTeachers.map((s) => s.subject.mentionId);
    const fromCursus = (await prisma.curriculumEntry.findMany({ where: { teacherId: t.userId }, select: { mentionId: true } })).map((c) => c.mentionId);
    const ids = [...new Set([...fromSubjects, ...fromCursus].filter(Boolean))];
    if (ids.length === 1) {
      await prisma.teacherProfile.update({ where: { id: t.id }, data: { mentionId: ids[0] } });
      teachersLinked += 1;
    }
  }

  if (rolesLinked || teachersLinked || permsAdded) {
    console.log(`🏷️  Mentions : ${rolesLinked} Responsable(s) et ${teachersLinked} enseignant(s) rattaché(s), ${permsAdded} droit(s) candidatures ajouté(s)`);
  }
  return { rolesLinked, teachersLinked, permsAdded };
}
