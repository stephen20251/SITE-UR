// Vérifie l'envoi d'e-mails configuré dans .env (SMTP_*).
//   node prisma/test-email.js destinataire@gmail.com
import 'dotenv/config';

const to = process.argv[2];
if (!to) {
  console.error('Indiquez le destinataire : node prisma/test-email.js destinataire@gmail.com');
  process.exit(1);
}
const { sendEmail, renderEmail } = await import('../src/utils/mailer.js');
const result = await sendEmail({
  to,
  subject: "Test d'envoi — Université Références",
  html: renderEmail({ title: "Test d'envoi réussi", body: "La plateforme peut envoyer des e-mails avec cette configuration." }),
});
if (result.sent && result.via === 'smtp') console.log(`✔ E-mail envoyé par SMTP à ${to}`);
else if (result.sent) console.log(`⚠ SMTP non configuré : e-mail seulement écrit dans ${result.file}`);
else {
  console.error(`✖ Échec de l'envoi : ${result.error}`);
  process.exitCode = 1;
}
