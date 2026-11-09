// Données de base d'une installation réelle, sans aucun compte ni donnée de démonstration :
// permissions, rôles et structure de l'université (voir base-data.json).
// Idempotent : ne crée que ce qui manque et n'écrase rien.
//   npm run seed:base        (enchaîne ensuite les paramètres financiers et les catégories)
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const base = JSON.parse(fs.readFileSync(new URL('./base-data.json', import.meta.url), 'utf8'));

for (const p of base.permissions) {
  await prisma.permission.upsert({ where: { code: p.code }, update: {}, create: p });
}
const permissionId = new Map((await prisma.permission.findMany({ select: { id: true, code: true } })).map((p) => [p.code, p.id]));

for (const { permissions, ...role } of base.roles) {
  const existing = await prisma.role.findUnique({ where: { name: role.name }, select: { id: true } });
  if (existing) continue; // rôle déjà là : ses permissions ont pu être ajustées par l'admin
  const created = await prisma.role.create({ data: role });
  await prisma.rolePermission.createMany({
    data: permissions.map((code) => ({ roleId: created.id, permissionId: permissionId.get(code) })),
  });
}

// Structure : chaque niveau est rattaché à son parent par son code.
const idOf = async (model, code) => (await prisma[model].findUniqueOrThrow({ where: { code }, select: { id: true } })).id;
for (const c of base.campuses) {
  await prisma.campus.upsert({ where: { code: c.code }, update: {}, create: c });
}
for (const { campusCode, ...f } of base.faculties) {
  await prisma.faculty.upsert({ where: { code: f.code }, update: {}, create: { ...f, campusId: await idOf('campus', campusCode) } });
}
for (const { facultyCode, ...d } of base.departments) {
  await prisma.department.upsert({ where: { code: d.code }, update: {}, create: { ...d, facultyId: await idOf('faculty', facultyCode) } });
}
for (const { departmentCode, ...m } of base.mentions) {
  await prisma.mention.upsert({ where: { code: m.code }, update: {}, create: { ...m, departmentId: await idOf('department', departmentCode) } });
}

console.log(`✔ ${base.permissions.length} permissions, ${base.roles.length} rôles, ${base.mentions.length} mentions`);
await prisma.$disconnect();
