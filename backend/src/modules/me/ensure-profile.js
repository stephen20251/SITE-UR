// ─────────────────────────────────────────────────────────────────────────────
// Garantit qu'un compte possède la fiche de profil correspondant à son rôle.
//
// Les comptes créés depuis l'administration (université ou online) n'avaient que
// la ligne User : la page « Mon profil » n'avait alors rien à afficher. On crée
// la fiche à la création du compte, et à la volée pour les comptes existants.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '../../database/prisma.js';

// Les comptes UR Online (STUDENT_ONLINE / TEACHER_ONLINE) n'ont pas de fiche universitaire :
// ils ne doivent pas apparaître dans les effectifs ni les listes de l'université.
const TEACHER_ROLES = ['TEACHER'];
const STUDENT_ROLES = ['STUDENT'];
const NO_PROFILE    = ['SUPER_ADMIN', 'CANDIDATE', 'STUDENT_ONLINE', 'TEACHER_ONLINE'];

// Matricule libre du type UR-2026-48213
async function freeMatricule() {
  const year = new Date().getFullYear();
  for (let i = 0; i < 10; i++) {
    const m = `UR-${year}-${String(Math.floor(10000 + Math.random() * 90000))}`;
    if (!(await prisma.studentProfile.findUnique({ where: { matricule: m }, select: { id: true } }))) return m;
  }
  return `UR-${year}-${Date.now()}`;
}

export async function ensureProfile(userId, systemRole) {
  if (!systemRole || NO_PROFILE.includes(systemRole)) return;
  if (TEACHER_ROLES.includes(systemRole)) {
    await prisma.teacherProfile.upsert({ where: { userId }, update: {}, create: { userId } });
  } else if (STUDENT_ROLES.includes(systemRole)) {
    const exists = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!exists) await prisma.studentProfile.create({ data: { userId, matricule: await freeMatricule() } });
  } else if (systemRole === 'PARENT') {
    await prisma.parentProfile.upsert({ where: { userId }, update: {}, create: { userId } });
  } else {
    await prisma.staffProfile.upsert({ where: { userId }, update: {}, create: { userId } });
  }
}
