// ─────────────────────────────────────────────────────────────────────────────
// Template registry — defines which templates exist, their inputs and roles.
// The actual rendering is done in documents.service.js.
// ─────────────────────────────────────────────────────────────────────────────
import { staffRoleKeys } from '../../utils/roles.js';

export const TEMPLATES = [
  // ── ÉTUDIANT ────────────────────────────────────────────────────────────────
  {
    id: 'carte-etudiant',
    name: "Carte d'étudiant",
    category: 'ETUDIANT',
    icon: 'CreditCard',
    description: 'Carte d\'identité universitaire avec QR Code et photo',
    allowedRoles: ['SUPER_ADMIN', 'STAFF', 'SECRETAIRE'],
    requiredInputs: [
      { key: 'studentId', type: 'student', label: 'Étudiant' },
    ],
  },
  {
    id: 'certificat-scolarite',
    name: 'Certificat de scolarité',
    category: 'ETUDIANT',
    icon: 'FileText',
    description: 'Atteste qu\'un étudiant est inscrit pour l\'année en cours',
    allowedRoles: ['SUPER_ADMIN', 'STAFF', 'SECRETAIRE'],
    requiredInputs: [
      { key: 'studentId', type: 'student', label: 'Étudiant' },
    ],
  },
  {
    id: 'attestation-inscription',
    name: "Attestation d'inscription",
    category: 'ETUDIANT',
    icon: 'ClipboardCheck',
    description: 'Document officiel confirmant l\'inscription universitaire',
    allowedRoles: ['SUPER_ADMIN', 'STAFF', 'SECRETAIRE'],
    requiredInputs: [
      { key: 'studentId', type: 'student', label: 'Étudiant' },
    ],
  },
  {
    id: 'attestation-frequentation',
    name: 'Attestation de fréquentation',
    category: 'ETUDIANT',
    icon: 'Calendar',
    description: 'Certifie la fréquentation régulière de l\'étudiant',
    allowedRoles: ['SUPER_ADMIN', 'STAFF', 'SECRETAIRE', 'CHEF_MENTION'],
    requiredInputs: [
      { key: 'studentId', type: 'student', label: 'Étudiant' },
      { key: 'semesterId', type: 'semester', label: 'Semestre' },
    ],
  },
  {
    id: 'releve-notes',
    name: 'Relevé de notes',
    category: 'ETUDIANT',
    icon: 'TrendingUp',
    description: 'Relevé officiel des notes par matière et par semestre',
    allowedRoles: ['SUPER_ADMIN', 'STAFF', 'SECRETAIRE', 'CHEF_MENTION', 'RESP_PEDA', 'TEACHER', 'STUDENT'],
    requiredInputs: [
      { key: 'studentId', type: 'student', label: 'Étudiant' },
      { key: 'semesterId', type: 'semester', label: 'Semestre' },
    ],
  },
  {
    id: 'bulletin',
    name: 'Bulletin semestriel',
    category: 'ETUDIANT',
    icon: 'BookOpen',
    description: 'Bulletin complet avec moyennes, crédits et résultat',
    allowedRoles: ['SUPER_ADMIN', 'STAFF', 'SECRETAIRE', 'CHEF_MENTION', 'RESP_PEDA', 'TEACHER', 'STUDENT'],
    requiredInputs: [
      { key: 'studentId', type: 'student', label: 'Étudiant' },
      { key: 'semesterId', type: 'semester', label: 'Semestre' },
    ],
  },
  {
    id: 'attestation-reussite',
    name: 'Attestation de réussite',
    category: 'ETUDIANT',
    icon: 'Award',
    description: 'Atteste que l\'étudiant a validé son semestre ou son année',
    allowedRoles: ['SUPER_ADMIN', 'STAFF', 'SECRETAIRE', 'CHEF_MENTION'],
    requiredInputs: [
      { key: 'studentId', type: 'student', label: 'Étudiant' },
      { key: 'semesterId', type: 'semester', label: 'Semestre' },
    ],
  },
  {
    id: 'recu-paiement',
    name: 'Reçu de paiement',
    category: 'ETUDIANT',
    icon: 'Receipt',
    description: 'Reçu officiel d\'un paiement de frais universitaires',
    allowedRoles: ['SUPER_ADMIN', 'STAFF', 'SECRETAIRE', 'COMPTABILITE'],
    requiredInputs: [
      { key: 'studentId', type: 'student', label: 'Étudiant' },
      { key: 'paymentId', type: 'payment', label: 'N° de reçu (vide = dernier paiement validé)', optional: true },
    ],
  },

  // ── ADMINISTRATION (documents enseignants + administration fusionnés) ───────────────────────────────────────────────────────────────
  {
    id: 'attestation-service',
    name: 'Attestation de service',
    category: 'ADMINISTRATION',
    icon: 'UserCheck',
    description: "Certifie qu'un enseignant est en service actif",
    allowedRoles: ['SUPER_ADMIN', 'STAFF', 'SECRETAIRE', 'CHEF_MENTION'],
    requiredInputs: [
      { key: 'teacherId', type: 'teacher', label: 'Enseignant' },
    ],
  },
  {
    id: 'certificat-travail',
    name: 'Certificat de travail',
    category: 'ADMINISTRATION',
    icon: 'Briefcase',
    description: "Certifie l'emploi et la fonction d'un enseignant",
    allowedRoles: ['SUPER_ADMIN', 'STAFF', 'SECRETAIRE', 'CHEF_MENTION'],
    requiredInputs: [
      { key: 'teacherId', type: 'teacher', label: 'Enseignant' },
    ],
  },

  // ── ADMINISTRATION ───────────────────────────────────────────────────────────
  {
    id: 'convocation',
    name: 'Convocation',
    category: 'ADMINISTRATION',
    icon: 'Bell',
    description: 'Convocation officielle pour un rendez-vous ou un examen',
    allowedRoles: ['SUPER_ADMIN', 'STAFF', 'SECRETAIRE', 'CHEF_MENTION'],
    requiredInputs: [
      { key: 'studentId', type: 'student', label: 'Étudiant' },
      { key: 'subject', type: 'text', label: 'Objet de la convocation' },
      { key: 'date', type: 'date', label: 'Date et heure' },
      { key: 'location', type: 'text', label: 'Lieu' },
    ],
  },
  {
    id: 'lettre-officielle',
    name: 'Lettre officielle',
    category: 'ADMINISTRATION',
    icon: 'Mail',
    description: 'Modèle de lettre officielle sur en-tête universitaire',
    allowedRoles: ['SUPER_ADMIN', 'STAFF', 'SECRETAIRE', 'CHEF_MENTION'],
    requiredInputs: [
      { key: 'recipientName', type: 'text', label: 'Destinataire' },
      { key: 'subject', type: 'text', label: 'Objet' },
      { key: 'body', type: 'textarea', label: 'Corps du message' },
    ],
  },
];

export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

export function getTemplatesForRole(systemRole, roleName = '') {
  const keys = staffRoleKeys(systemRole, roleName);
  return TEMPLATES.filter((t) => t.allowedRoles.some((r) => keys.includes(r)));
}
