// E-mails liés aux comptes : création par l'administration, mot de passe réinitialisé,
// lien « mot de passe oublié ». Ne lèvent jamais d'erreur : un échec d'envoi ne doit pas
// bloquer l'action. Renvoient true si l'e-mail est réellement parti (SMTP configuré).
import { escapeHtml, renderEmail, sendEmail } from './mailer.js';

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super administrateur',
  STAFF: 'Personnel administratif',
  TEACHER: 'Enseignant',
  STUDENT: 'Étudiant',
  PARENT: 'Parent',
  CANDIDATE: 'Candidat',
  STUDENT_ONLINE: 'Apprenant UR Online',
  TEACHER_ONLINE: 'Formateur UR Online',
};

// Page de connexion selon le type de compte
export const loginPath = (systemRole) => (['STUDENT_ONLINE', 'TEACHER_ONLINE'].includes(systemRole) ? '/online/login' : '/classroom');

const codeBlock = (value) =>
  `<span style="display:inline-block;margin-top:6px;padding:8px 14px;border-radius:8px;background:#f3f4f6;font-family:Consolas,monospace;font-size:16px;letter-spacing:1px;color:#111827">${escapeHtml(value)}</span>`;

async function send(to, subject, content) {
  const result = await sendEmail({ to, subject, html: renderEmail(content) });
  return result.sent && result.via === 'smtp';
}

export function sendAccountCreatedEmail(user, { temporaryPassword } = {}) {
  const access = temporaryPassword
    ? `Votre mot de passe provisoire :<br/>${codeBlock(temporaryPassword)}<br/><br/>Changez-le dès votre première connexion, dans « Mon profil ».`
    : `Votre mot de passe vous est communiqué par l'administration. En cas d'oubli, utilisez « Mot de passe oublié » sur la page de connexion.`;
  return send(user.email, 'Votre compte Université Références', {
    title: 'Votre compte est prêt',
    greeting: `Bonjour ${escapeHtml(user.firstName)},`,
    body: `L'administration de l'Université Références vous a créé un compte <b>${escapeHtml(ROLE_LABELS[user.systemRole] ?? user.systemRole)}</b>.<br/><br/>
      Identifiant : <b>${escapeHtml(user.email)}</b><br/><br/>${access}`,
    ctaLabel: 'Se connecter',
    ctaUrl: loginPath(user.systemRole),
  });
}

export function sendPasswordResetByAdminEmail(user, { temporaryPassword }) {
  return send(user.email, 'Votre nouveau mot de passe — Université Références', {
    title: 'Mot de passe réinitialisé',
    greeting: `Bonjour ${escapeHtml(user.firstName)},`,
    body: `L'administration a réinitialisé le mot de passe de votre compte <b>${escapeHtml(user.email)}</b>.<br/><br/>
      Mot de passe provisoire :<br/>${codeBlock(temporaryPassword)}<br/><br/>Changez-le dès votre connexion, dans « Mon profil ».
      Si vous n'êtes pas à l'origine de cette demande, contactez le secrétariat.`,
    ctaLabel: 'Se connecter',
    ctaUrl: loginPath(user.systemRole),
  });
}

export function sendForgotPasswordEmail(user, resetUrl) {
  return send(user.email, 'Choisir un nouveau mot de passe — Université Références', {
    title: 'Mot de passe oublié',
    greeting: `Bonjour ${escapeHtml(user.firstName)},`,
    body: `Vous avez demandé à changer le mot de passe du compte <b>${escapeHtml(user.email)}</b>.
      Ce lien est valable 1 heure et ne sert qu'une fois.<br/><br/>
      Si vous n'avez rien demandé, ignorez cet e-mail : votre mot de passe reste inchangé.`,
    ctaLabel: 'Choisir un nouveau mot de passe',
    ctaUrl: resetUrl,
  });
}
