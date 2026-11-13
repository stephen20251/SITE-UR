// ─────────────────────────────────────────────────────────────────────────────
// Liaison entre les trois façons de « créer une matière » :
//   • Configuration → Matières & UE (Super administrateur) : table Subject ;
//   • Cursus universitaire (Responsable pédagogique) : CurriculumEntry, avec un
//     intitulé libre et un enseignant (User) ;
//   • Affectation des matières : SubjectTeacher (Subject ↔ TeacherProfile).
//
// Sans liaison, un cours planifié dans le cursus n'existait pas comme matière :
// il n'apparaissait ni dans l'emploi du temps, ni dans l'affectation, et
// l'enseignant attribué dans l'un ne le retrouvait pas dans l'autre.
// Ici, chaque élément du cursus est rattaché à une matière (créée au besoin) et
// l'enseignant attribué d'un côté est reporté de l'autre.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '../../database/prisma.js';
import { ensureProfile } from '../me/ensure-profile.js';

const clean = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');

// Code libre du type INFO-L1-03 (le code d'une matière est unique dans toute l'université).
async function freeSubjectCode(mentionCode, level) {
  const prefix = `${String(mentionCode || 'MAT').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'MAT'}-${level || 'X'}-`;
  const taken = new Set(
    (await prisma.subject.findMany({ where: { code: { startsWith: prefix } }, select: { code: true } })).map((s) => s.code),
  );
  for (let n = 1; n < 1000; n++) {
    const code = `${prefix}${String(n).padStart(2, '0')}`;
    if (!taken.has(code)) return code;
  }
  return `${prefix}${Date.now()}`;
}

// Matière d'un élément du cursus : celle choisie, sinon celle de la mention qui porte
// le même intitulé, sinon une nouvelle matière créée à partir de l'intitulé.
export async function ensureSubjectFor({ mentionId, title, level, subjectId }) {
  if (subjectId) {
    // Une matière désactivée redevient active : elle est de nouveau utilisée.
    await prisma.subject.updateMany({ where: { id: subjectId, isActive: false }, data: { isActive: true } });
    return subjectId;
  }
  const name = clean(title);
  if (!mentionId || !name) return null;
  // Comparaison insensible à la casse (MySQL), en mémoire pour rester indépendant du moteur.
  const same = (await prisma.subject.findMany({ where: { mentionId }, select: { id: true, name: true, isActive: true } }))
    .find((s) => clean(s.name).toLowerCase() === name.toLowerCase());
  if (same) {
    if (!same.isActive) await prisma.subject.update({ where: { id: same.id }, data: { isActive: true } });
    return same.id;
  }
  const mention = await prisma.mention.findUnique({ where: { id: mentionId }, select: { code: true } });
  if (!mention) return null;
  const s = await prisma.subject.create({
    data: { mentionId, name, code: await freeSubjectCode(mention.code, level), credits: 3, weeklyHours: 2 },
  });
  return s.id;
}

// Fiche enseignant universitaire d'un compte (null pour un compte UR Online).
async function teacherProfileId(userId) {
  if (!userId) return null;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
  if (u?.systemRole !== 'TEACHER') return null;
  await ensureProfile(userId, 'TEACHER');
  return (await prisma.teacherProfile.findUnique({ where: { userId }, select: { id: true } }))?.id ?? null;
}

// Reporte l'enseignant du cursus dans l'affectation des matières (cours magistral).
export async function syncTeacherAssignment({ subjectId, teacherUserId, previousTeacherUserId, assignedBy }) {
  if (!subjectId) return;
  if (teacherUserId) {
    const teacherId = await teacherProfileId(teacherUserId);
    if (teacherId) {
      const exists = await prisma.subjectTeacher.findFirst({ where: { subjectId, teacherId }, select: { id: true } });
      if (!exists) {
        await prisma.subjectTeacher.create({ data: { subjectId, teacherId, type: 'CM', groupId: null, assignedBy: assignedBy ?? null } })
          .catch(() => {}); // course concurrente : l'affectation existe déjà
      }
    }
  }
  // L'ancien enseignant perd l'affectation s'il n'enseigne plus cette matière dans le cursus.
  if (previousTeacherUserId && previousTeacherUserId !== teacherUserId) {
    const stillTeaching = await prisma.curriculumEntry.count({ where: { subjectId, teacherId: previousTeacherUserId } });
    if (!stillTeaching) {
      const oldId = (await prisma.teacherProfile.findUnique({ where: { userId: previousTeacherUserId }, select: { id: true } }))?.id;
      if (oldId) await prisma.subjectTeacher.deleteMany({ where: { subjectId, teacherId: oldId, type: 'CM', groupId: null } });
    }
  }
}

// Sens inverse : une affectation faite dans « Affectation des matières » attribue les
// cours du cursus de cette matière qui n'ont pas encore d'enseignant.
export async function assignCurriculumFromSubject({ subjectId, teacherProfileId: tpId }) {
  const tp = await prisma.teacherProfile.findUnique({ where: { id: tpId }, select: { userId: true } });
  if (!tp) return [];
  const entries = await prisma.curriculumEntry.findMany({ where: { subjectId, teacherId: null }, select: { id: true } });
  if (entries.length) {
    await prisma.curriculumEntry.updateMany({ where: { id: { in: entries.map((e) => e.id) } }, data: { teacherId: tp.userId } });
  }
  return entries.map((e) => e.id);
}

// Retrait d'une affectation : les cours du cursus pas encore construits sont libérés.
export async function releaseCurriculumFromSubject({ subjectId, teacherProfileId: tpId }) {
  const tp = await prisma.teacherProfile.findUnique({ where: { id: tpId }, select: { userId: true } });
  if (!tp) return;
  const others = await prisma.subjectTeacher.count({ where: { subjectId, teacherId: tpId } });
  if (others) return; // l'enseignant garde une autre affectation (TD, TP…) sur la matière
  await prisma.curriculumEntry.updateMany({ where: { subjectId, teacherId: tp.userId, courseId: null }, data: { teacherId: null } });
}

// Rattrapage au démarrage du serveur (idempotent) : les éléments du cursus créés
// avant cette liaison reçoivent leur matière et leur affectation.
export async function syncCurriculumSubjects() {
  const entries = await prisma.curriculumEntry.findMany({
    select: { id: true, mentionId: true, title: true, level: true, subjectId: true, teacherId: true, createdById: true },
  });
  let linked = 0;
  for (const e of entries) {
    let subjectId = e.subjectId;
    if (!subjectId) {
      subjectId = await ensureSubjectFor(e);
      if (subjectId) {
        await prisma.curriculumEntry.update({ where: { id: e.id }, data: { subjectId } });
        linked++;
      }
    }
    if (subjectId && e.teacherId) await syncTeacherAssignment({ subjectId, teacherUserId: e.teacherId, assignedBy: e.createdById });
  }
  if (linked) console.log(`📚 Cursus : ${linked} cours rattaché(s) à une matière`);
}
