// Crée le compte Super administrateur, ou change son mot de passe s'il existe déjà.
//   npm run create:admin
// Le mot de passe se saisit dans le terminal : il n'est ni affiché ni enregistré en clair.
// Sans terminal interactif : variables ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME.
import 'dotenv/config';
import readline from 'readline';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/hash.js';

const prisma = new PrismaClient();
const MIN_LENGTH = 12;

const ask = (question) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
});

// Lecture sans écho : rien ne s'affiche pendant la frappe.
const askHidden = (question) => new Promise((resolve) => {
  process.stdout.write(question);
  const { stdin } = process;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  let value = '';
  const onData = (chunk) => {
    for (const ch of chunk) {
      if (ch === '\u0003') process.exit(1); // Ctrl+C
      if (ch === '\r' || ch === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        return resolve(value);
      }
      if (ch === '\u0008' || ch === '\u007f') value = value.slice(0, -1);
      else value += ch;
    }
  };
  stdin.on('data', onData);
});

async function readInput() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    return { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, firstName: ADMIN_FIRST_NAME || 'Super', lastName: ADMIN_LAST_NAME || 'Administrateur' };
  }
  if (!process.stdin.isTTY) {
    throw new Error('Terminal non interactif : lancez la commande dans PowerShell, ou définissez ADMIN_EMAIL et ADMIN_PASSWORD.');
  }
  const email = await ask('Adresse e-mail (Gmail) : ');
  const firstName = await ask('Prénom : ');
  const lastName = await ask('Nom : ');
  const password = await askHidden(`Mot de passe (${MIN_LENGTH} caractères minimum, invisible à l'écran) : `);
  const confirm = await askHidden('Confirmez le mot de passe : ');
  if (password !== confirm) throw new Error('Les deux mots de passe ne correspondent pas.');
  return { email, password, firstName, lastName };
}

try {
  const input = await readInput();
  const email = input.email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Adresse e-mail invalide.');
  if (input.password.length < MIN_LENGTH) throw new Error(`Mot de passe trop court (${MIN_LENGTH} caractères minimum).`);
  if (/password123|etudiant123/i.test(input.password)) throw new Error('Ce mot de passe est public : choisissez-en un autre.');

  const role = await prisma.role.findUnique({ where: { name: 'Super Administrateur' } });
  if (!role) throw new Error('Rôle « Super Administrateur » introuvable : lancez d\'abord « npm run seed:base ».');

  const passwordHash = await hashPassword(input.password);
  const existing = await prisma.user.findUnique({ where: { email } });
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, systemRole: 'SUPER_ADMIN', isActive: true },
    create: {
      email, passwordHash, systemRole: 'SUPER_ADMIN', isActive: true, emailVerified: true,
      firstName: input.firstName || 'Super', lastName: input.lastName || 'Administrateur',
    },
  });
  if (!(await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id } }))) {
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  }
  if (existing) await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  console.log(`✔ Super administrateur ${existing ? 'mis à jour' : 'créé'} : ${email}`);
} catch (e) {
  console.error(`✖ ${e.message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
