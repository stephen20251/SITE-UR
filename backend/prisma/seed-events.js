// Permission de gestion des événements (section « Actualité » de l'accueil).
//   node prisma/seed-events.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const perm = await prisma.permission.upsert({
  where: { code: 'MANAGE_EVENTS' },
  update: {},
  create: { code: 'MANAGE_EVENTS', label: 'Gérer les événements de l\'université', module: 'COMMUNICATION' },
});

for (const roleName of ['Secrétaire / Admissions', 'Super Administrateur']) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) { console.warn(`  ⚠ rôle « ${roleName} » introuvable`); continue; }
  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
    update: {}, create: { roleId: role.id, permissionId: perm.id },
  });
  console.log(`✔ MANAGE_EVENTS → ${roleName}`);
}
await prisma.$disconnect();
