// Préparation de la base au démarrage (« npm start ») — aucun terminal requis sur l'hébergeur.
//  1. applique les migrations en attente (prisma migrate deploy) ;
//  2. base vide (aucun rôle) : installe les données de base (seed-base, paramètres, catégories) ;
//  3. ADMIN_EMAIL + ADMIN_PASSWORD définis et ce compte absent : crée le Super administrateur.
//     Un compte existant n'est pas modifié, sauf si ADMIN_RESET_PASSWORD=oui : son mot de passe est
//     alors remplacé par ADMIN_PASSWORD (dépannage sans e-mail). Retirez ces variables ensuite.
// Une erreur arrête le démarrage, avec un message clair dans les journaux.
import 'dotenv/config';
import { spawnSync } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// La configuration est vérifiée AVANT de toucher à la base : une configuration
// refusée ne doit jamais laisser une migration à moitié appliquée.
await import('../src/config/env.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(here, '..');

function run(label, args) {
  console.log(`▶ ${label}`);
  const r = spawnSync(process.execPath, args, { cwd: backend, stdio: 'inherit', env: process.env });
  if (r.status !== 0) {
    console.error(`✖ Échec : ${label}`);
    process.exit(r.status ?? 1);
  }
}

const prismaCli = path.join(backend, 'node_modules', 'prisma', 'build', 'index.js');
run('Migrations de la base', [prismaCli, 'migrate', 'deploy']);

const prisma = new PrismaClient();
try {
  if ((await prisma.role.count()) === 0) {
    run('Données de base (rôles, structure)', ['prisma/seed-base.js']);
    run('Paramètres financiers et RH', ['prisma/seed-maj-ur2.js']);
    run('Catégories des cours en ligne', ['prisma/seed-categories.js']);
  }
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const exists = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL.toLowerCase().trim() }, select: { id: true } });
    const reset = /^(oui|1|true|yes)$/i.test((process.env.ADMIN_RESET_PASSWORD ?? '').trim());
    if (!exists) run('Création du Super administrateur', ['prisma/create-admin.js']);
    else if (reset) run('Nouveau mot de passe du Super administrateur', ['prisma/create-admin.js']);
    else console.log('ℹ Super administrateur déjà créé : retirez ADMIN_EMAIL et ADMIN_PASSWORD des variables.');
  }
} finally {
  await prisma.$disconnect();
}

// Dossiers des fichiers déposés
const { UPLOADS_DIR, PRIVATE_UPLOADS_DIR } = await import('../src/config/paths.js');
for (const dir of [UPLOADS_DIR, PRIVATE_UPLOADS_DIR]) fs.mkdirSync(dir, { recursive: true });
console.log(`✔ Base prête — fichiers : ${UPLOADS_DIR}`);
