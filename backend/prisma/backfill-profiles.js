// Crée la fiche de profil manquante (enseignant, parent, personnel…) des comptes
// universitaires créés avant la correction. Sans risque : n'écrase rien.
//   node prisma/backfill-profiles.js
import { PrismaClient } from '@prisma/client';
import { ensureProfile } from '../src/modules/me/ensure-profile.js';

const prisma = new PrismaClient();
const users = await prisma.user.findMany({
  where: {
    systemRole: { notIn: ['SUPER_ADMIN', 'CANDIDATE', 'STUDENT_ONLINE', 'TEACHER_ONLINE'] },
    teacherProfile: null, studentProfile: null, parentProfile: null, staffProfile: null,
  },
  select: { id: true, email: true, systemRole: true },
});
for (const u of users) {
  await ensureProfile(u.id, u.systemRole);
  console.log(`✔ ${u.email} (${u.systemRole})`);
}
console.log(`${users.length} fiche(s) créée(s).`);
await prisma.$disconnect();
