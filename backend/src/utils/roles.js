// Noms des rôles du personnel. Chef de Mention et Responsable Pédagogique ont été
// fusionnés en un « Responsable <mention> » (Responsable Info, Responsable Gestion…).
export const MENTION_RESPONSIBLE_ROLES = ['Responsable Info', 'Responsable Gestion'];
export const PRESENCE_ROLE = 'Responsable Présence';

export function isMentionResponsible(roleName = '') {
  return (roleName.startsWith('Responsable ') && roleName !== PRESENCE_ROLE)
    || roleName.includes('Chef de Mention');
}

// Clés de rôle utilisées par les modèles de documents / lettres.
// Un Responsable de mention cumule les droits CHEF_MENTION et RESP_PEDA.
export function staffRoleKeys(systemRole, roleName = '') {
  if (systemRole === 'SUPER_ADMIN') return ['SUPER_ADMIN'];
  if (systemRole === 'TEACHER') return ['TEACHER'];
  if (systemRole === 'STUDENT') return ['STUDENT'];
  if (roleName.includes('Secrétaire')) return ['SECRETAIRE'];
  if (roleName.includes('Comptabilité')) return ['COMPTABILITE'];
  if (isMentionResponsible(roleName)) return ['CHEF_MENTION', 'RESP_PEDA'];
  return ['STAFF'];
}

// Libellé affiché : les « Responsable <mention> » sont présentés comme
// « Responsable Pédagogique » (fusion Chef de Mention + Resp. Pédagogique).
export function displayRoleName(roleName = '') {
  if (!roleName) return '';
  if (isMentionResponsible(roleName)) return 'Responsable Pédagogique';
  return roleName;
}

// Un semestre est « terminé » quand sa date de fin est passée ET qu'il n'est plus
// le semestre actif (l'administration le clôture en activant le suivant).
export function isSemesterFinished(semester, now = new Date()) {
  return !!semester && semester.endDate < now && !semester.isActive;
}
