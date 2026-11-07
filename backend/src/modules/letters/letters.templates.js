// Letter template registry — body uses {{variable}} placeholders

export const LETTER_TEMPLATES = [
  // ── ÉTUDIANT ──────────────────────────────────────────────────────────────
  {
    id: 'certificat-scolarite-ltr',
    name: 'Certificat de scolarité',
    category: 'ETUDIANT',
    icon: 'FileText',
    description: "Certifie qu'un étudiant est régulièrement inscrit pour l'année en cours.",
    allowedRoles: ['SUPER_ADMIN','CHEF_MENTION','SECRETAIRE','RESP_PEDA'],
    requiredInputs: [{ key: 'studentId', type: 'student', label: 'Étudiant' }],
    signatoryRoles: ['Responsable Info', 'Responsable Gestion', 'Secrétaire'],
    body: `<p>Nous soussignés, la Direction de l'Université de Référence, certifions que :</p>
<p style="text-align:center;font-size:1.1em;font-weight:600;margin:24px 0;text-decoration:underline;">{{student.fullName}}</p>
<p>né(e) le <strong>{{student.birthDate}}</strong>, matricule <strong>{{student.matricule}}</strong>,
est régulièrement inscrit(e) en <strong>{{student.level}}</strong> — mention <strong>{{student.mention}}</strong>
pour l'année universitaire <strong>{{academicYear}}</strong>.</p>
<p>Ce certificat est délivré pour servir et valoir ce que de droit.</p>`,
  },
  {
    id: 'attestation-inscription-ltr',
    name: "Attestation d'inscription",
    category: 'ETUDIANT',
    icon: 'ClipboardCheck',
    description: "Confirme l'inscription administrative d'un étudiant.",
    allowedRoles: ['SUPER_ADMIN','CHEF_MENTION','SECRETAIRE'],
    requiredInputs: [{ key: 'studentId', type: 'student', label: 'Étudiant' }],
    signatoryRoles: ['Secrétaire'],
    body: `<p>La Direction des Affaires Académiques de l'Université de Référence atteste que :</p>
<p style="text-align:center;font-size:1.1em;font-weight:600;margin:24px 0;">{{student.fullName}}</p>
<p>matricule <strong>{{student.matricule}}</strong>, est inscrit(e) en
<strong>{{student.level}} — {{student.mention}}</strong>, groupe <strong>{{student.group}}</strong>,
pour l'année universitaire <strong>{{academicYear}}</strong>.</p>`,
  },
  {
    id: 'attestation-reussite-ltr',
    name: 'Attestation de réussite',
    category: 'ETUDIANT',
    icon: 'Award',
    description: "Confirme qu'un étudiant a validé son année universitaire.",
    allowedRoles: ['SUPER_ADMIN','CHEF_MENTION','RESP_PEDA'],
    requiredInputs: [
      { key: 'studentId', type: 'student', label: 'Étudiant' },
      { key: 'semesterId', type: 'semester', label: 'Semestre validé' },
    ],
    signatoryRoles: ['Responsable Info', 'Responsable Gestion'],
    body: `<p>Nous certifions que :</p>
<p style="text-align:center;font-size:1.1em;font-weight:600;margin:24px 0;">{{student.fullName}}</p>
<p>matricule <strong>{{student.matricule}}</strong>, inscrit(e) en <strong>{{student.level}} — {{student.mention}}</strong>,
a satisfait aux épreuves du semestre <strong>{{semester.name}}</strong>
de l'année universitaire <strong>{{academicYear}}</strong> et est déclaré(e) <strong>ADMIS(E)</strong>.</p>`,
  },
  {
    id: 'convocation-etudiant-ltr',
    name: 'Convocation étudiant',
    category: 'ETUDIANT',
    icon: 'Bell',
    description: 'Convoque un étudiant à se présenter pour un motif précis.',
    allowedRoles: ['SUPER_ADMIN','CHEF_MENTION','SECRETAIRE','RESP_PEDA'],
    requiredInputs: [
      { key: 'studentId', type: 'student', label: 'Étudiant' },
      { key: 'date', type: 'datetime-local', label: 'Date et heure' },
      { key: 'lieu', type: 'text', label: 'Lieu' },
      { key: 'motif', type: 'textarea', label: 'Motif de la convocation' },
    ],
    signatoryRoles: ['Responsable Info', 'Responsable Gestion'],
    body: `<p>Monsieur / Madame <strong>{{student.fullName}}</strong> — Matricule : <strong>{{student.matricule}}</strong></p>
<p>Vous êtes prié(e) de vous présenter le <strong>{{date}}</strong> à <strong>{{lieu}}</strong> pour :</p>
<blockquote style="border-left:4px solid #2d3748;padding-left:16px;margin:20px 0;font-style:italic;">{{motif}}</blockquote>
<p>Votre présence est <strong>obligatoire</strong>. Toute absence non justifiée sera sanctionnée.</p>`,
  },
  {
    id: 'avertissement-ltr',
    name: 'Avertissement',
    category: 'ETUDIANT',
    icon: 'AlertTriangle',
    description: 'Avertissement disciplinaire adressé à un étudiant.',
    allowedRoles: ['SUPER_ADMIN','CHEF_MENTION'],
    requiredInputs: [
      { key: 'studentId', type: 'student', label: 'Étudiant' },
      { key: 'faits', type: 'textarea', label: 'Faits reprochés' },
    ],
    signatoryRoles: ['Responsable Info', 'Responsable Gestion'],
    body: `<p>L'administration porte à la connaissance de :</p>
<p style="text-align:center;font-size:1.1em;font-weight:600;margin:24px 0;">{{student.fullName}}</p>
<p>que suite aux faits suivants :</p>
<blockquote style="border-left:4px solid #e53e3e;padding-left:16px;margin:20px 0;color:#c53030;">{{faits}}</blockquote>
<p>Un <strong>AVERTISSEMENT</strong> lui est adressé. Tout renouvellement entraînera des sanctions plus sévères.</p>`,
  },
  {
    id: 'felicitations-ltr',
    name: 'Félicitations',
    category: 'ETUDIANT',
    icon: 'Star',
    description: 'Lettre de félicitations pour résultats excellents.',
    allowedRoles: ['SUPER_ADMIN','CHEF_MENTION','RESP_PEDA'],
    requiredInputs: [
      { key: 'studentId', type: 'student', label: 'Étudiant' },
      { key: 'motif', type: 'textarea', label: 'Motif des félicitations' },
    ],
    signatoryRoles: ['Responsable Info', 'Responsable Gestion'],
    body: `<p>L'administration de l'Université de Référence est heureuse de féliciter :</p>
<p style="text-align:center;font-size:1.1em;font-weight:600;margin:24px 0;">{{student.fullName}}</p>
<p>pour {{motif}}</p>
<p>Nous l'encourageons à poursuivre ses efforts et lui souhaitons une pleine réussite dans la suite de son parcours.</p>`,
  },
  {
    id: 'lettre-parents-ltr',
    name: "Lettre d'information aux parents",
    category: 'ETUDIANT',
    icon: 'Mail',
    description: "Communication officielle destinée aux parents d'un étudiant.",
    allowedRoles: ['SUPER_ADMIN','CHEF_MENTION','SECRETAIRE'],
    requiredInputs: [
      { key: 'studentId', type: 'student', label: 'Étudiant concerné' },
      { key: 'objet', type: 'text', label: 'Objet de la lettre' },
      { key: 'corps', type: 'textarea', label: 'Corps du message' },
    ],
    signatoryRoles: ['Secrétaire', 'Responsable Info', 'Responsable Gestion'],
    body: `<p><strong>Objet :</strong> {{objet}}</p>
<p>Madame, Monsieur,</p>
<p>Nous vous contactons au sujet de votre enfant <strong>{{student.fullName}}</strong>,
inscrit(e) en <strong>{{student.level}} — {{student.mention}}</strong>.</p>
<p>{{corps}}</p>
<p>Nous restons à votre disposition pour tout renseignement complémentaire.<br>
Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.</p>`,
  },

  // ── ENSEIGNANT ────────────────────────────────────────────────────────────
  {
    id: 'affectation-enseignant-ltr',
    name: "Décision d'affectation",
    category: 'ENSEIGNANT',
    icon: 'UserCheck',
    description: "Décision officielle d'affectation d'un enseignant.",
    allowedRoles: ['SUPER_ADMIN','RESP_PEDA'],
    requiredInputs: [
      { key: 'teacherId', type: 'teacher', label: 'Enseignant' },
      { key: 'poste', type: 'text', label: "Poste / Unité d'affectation" },
      { key: 'dateEffet', type: 'datetime-local', label: "Date d'effet" },
    ],
    signatoryRoles: ['Responsable Info', 'Responsable Gestion'],
    body: `<p>La Direction de l'Université de Référence décide :</p>
<p>Monsieur / Madame <strong>{{teacher.fullName}}</strong>, <em>{{teacher.specialization}}</em>,
est affecté(e) au poste de <strong>{{poste}}</strong> à compter du <strong>{{dateEffet}}</strong>.</p>
<p>L'intéressé(e) est chargé(e) de prendre ses fonctions à la date indiquée.</p>`,
  },
  {
    id: 'attestation-service-ltr',
    name: 'Attestation de service',
    category: 'ENSEIGNANT',
    icon: 'Briefcase',
    description: "Atteste qu'un enseignant est en activité dans l'établissement.",
    allowedRoles: ['SUPER_ADMIN','SECRETAIRE','RESP_PEDA'],
    requiredInputs: [{ key: 'teacherId', type: 'teacher', label: 'Enseignant' }],
    signatoryRoles: ['Responsable Info', 'Responsable Gestion'],
    body: `<p>Nous soussignés, la Direction de l'Université de Référence, attestons que :</p>
<p style="text-align:center;font-size:1.1em;font-weight:600;margin:24px 0;">{{teacher.fullName}}</p>
<p>est membre du corps enseignant pour l'année universitaire <strong>{{academicYear}}</strong>,
et assure des enseignements en <strong>{{teacher.specialization}}</strong>.</p>
<p>Cette attestation est délivrée à la demande de l'intéressé(e) pour servir et valoir ce que de droit.</p>`,
  },
  {
    id: 'convocation-enseignant-ltr',
    name: 'Convocation enseignant',
    category: 'ENSEIGNANT',
    icon: 'Bell',
    description: 'Convoque un enseignant pour une réunion ou un entretien.',
    allowedRoles: ['SUPER_ADMIN','RESP_PEDA','CHEF_MENTION'],
    requiredInputs: [
      { key: 'teacherId', type: 'teacher', label: 'Enseignant' },
      { key: 'date', type: 'datetime-local', label: 'Date et heure' },
      { key: 'lieu', type: 'text', label: 'Lieu' },
      { key: 'motif', type: 'textarea', label: 'Motif' },
    ],
    signatoryRoles: ['Responsable Info', 'Responsable Gestion'],
    body: `<p>Monsieur / Madame <strong>{{teacher.fullName}}</strong>,</p>
<p>Vous êtes prié(e) de vous présenter le <strong>{{date}}</strong> à <strong>{{lieu}}</strong>.</p>
<p><strong>Motif :</strong> {{motif}}</p>`,
  },
  {
    id: 'renouvellement-ltr',
    name: 'Renouvellement de contrat',
    category: 'ENSEIGNANT',
    icon: 'RefreshCw',
    description: "Lettre de renouvellement de contrat d'enseignement.",
    allowedRoles: ['SUPER_ADMIN','RESP_PEDA'],
    requiredInputs: [
      { key: 'teacherId', type: 'teacher', label: 'Enseignant' },
      { key: 'duree', type: 'text', label: 'Durée du renouvellement' },
      { key: 'dateEffet', type: 'datetime-local', label: "Date d'effet" },
    ],
    signatoryRoles: ['Directeur Général'],
    body: `<p>Suite à votre engagement et à vos résultats au cours de la période écoulée, nous avons le plaisir
de vous informer que votre contrat d'enseignement est renouvelé pour une durée de <strong>{{duree}}</strong>
à compter du <strong>{{dateEffet}}</strong>.</p>
<p>L'enseignant(e) <strong>{{teacher.fullName}}</strong> continuera d'assurer ses fonctions
dans les conditions précédemment définies.</p>`,
  },

  // ── ENSEIGNANT — Ordre de mission ─────────────────────────────────────────
  {
    id: 'ordre-mission-enseignant-ltr',
    name: 'Ordre de mission — Enseignant',
    category: 'ENSEIGNANT',
    icon: 'Navigation',
    description: 'Autorise un enseignant à effectuer un déplacement professionnel.',
    allowedRoles: ['SUPER_ADMIN','RESP_PEDA','SECRETAIRE'],
    requiredInputs: [
      { key: 'teacherId',  type: 'teacher', label: 'Enseignant' },
      { key: 'destination', type: 'text', label: 'Destination' },
      { key: 'dateDepart', type: 'datetime-local', label: 'Date de départ' },
      { key: 'dateRetour', type: 'datetime-local', label: 'Date de retour' },
      { key: 'motif',      type: 'textarea', label: 'Motif de la mission' },
    ],
    signatoryRoles: ['Responsable Info', 'Responsable Gestion'],
    body: `<p>Il est ordonné à <strong>{{teacher.fullName}}</strong>, <em>{{teacher.specialization}}</em>,
de se rendre à <strong>{{destination}}</strong> du <strong>{{dateDepart}}</strong> au <strong>{{dateRetour}}</strong>.</p>
<p><strong>Motif :</strong> {{motif}}</p>
<p>Les frais de déplacement sont pris en charge par l'établissement sur présentation des justificatifs.</p>`,
  },

  // ── PERSONNEL ─────────────────────────────────────────────────────────────
  {
    id: 'ordre-mission-ltr',
    name: 'Ordre de mission',
    category: 'PERSONNEL',
    icon: 'Navigation',
    description: 'Autorise un agent à effectuer un déplacement professionnel.',
    allowedRoles: ['SUPER_ADMIN','SECRETAIRE'],
    requiredInputs: [
      { key: 'staffId',     type: 'staff', label: "Agent" },
      { key: 'destination', type: 'text', label: 'Destination' },
      { key: 'dateDepart',  type: 'datetime-local', label: 'Date de départ' },
      { key: 'dateRetour',  type: 'datetime-local', label: 'Date de retour' },
      { key: 'motif',       type: 'textarea', label: 'Motif de la mission' },
    ],
    signatoryRoles: ['Directeur Général'],
    body: `<p>Il est ordonné à <strong>{{staff.fullName}}</strong>, <em>{{staff.function}}</em>, <em>{{staff.department}}</em>,
de se rendre à <strong>{{destination}}</strong> du <strong>{{dateDepart}}</strong> au <strong>{{dateRetour}}</strong>.</p>
<p><strong>Motif :</strong> {{motif}}</p>
<p>Les frais de déplacement sont pris en charge par l'établissement sur présentation des justificatifs.</p>`,
  },
  {
    id: 'attestation-travail-ltr',
    name: 'Attestation de travail',
    category: 'PERSONNEL',
    icon: 'FileCheck',
    description: "Atteste qu'un agent est en activité au sein de l'établissement.",
    allowedRoles: ['SUPER_ADMIN','SECRETAIRE'],
    requiredInputs: [
      { key: 'staffId', type: 'staff', label: "Agent" },
    ],
    signatoryRoles: ['Directeur Général'],
    body: `<p>Nous soussignés, la Direction de l'Université de Référence, attestons que :</p>
<p style="text-align:center;font-size:1.1em;font-weight:600;margin:24px 0;">{{staff.fullName}}</p>
<p>occupe la fonction de <strong>{{staff.function}}</strong>, service <strong>{{staff.department}}</strong>,
au sein de notre établissement pour l'année <strong>{{academicYear}}</strong>.</p>
<p>Cette attestation est délivrée à la demande de l'intéressé(e) pour servir et valoir ce que de droit.</p>`,
  },
  {
    id: 'autorisation-absence-ltr',
    name: "Autorisation d'absence",
    category: 'PERSONNEL',
    icon: 'FileText',
    description: "Autorise un agent à s'absenter pour un motif précis.",
    allowedRoles: ['SUPER_ADMIN','SECRETAIRE'],
    requiredInputs: [
      { key: 'staffId',    type: 'staff', label: "Agent" },
      { key: 'dateDebut',  type: 'datetime-local', label: 'Du' },
      { key: 'dateFin',    type: 'datetime-local', label: 'Au' },
      { key: 'motif',      type: 'textarea', label: "Motif de l'absence" },
    ],
    signatoryRoles: ['Directeur Général'],
    body: `<p>Nous autorisons <strong>{{staff.fullName}}</strong>, <em>{{staff.function}}</em>,
à s'absenter du <strong>{{dateDebut}}</strong> au <strong>{{dateFin}}</strong>.</p>
<p><strong>Motif :</strong> {{motif}}</p>
<p>L'intéressé(e) devra veiller à assurer la continuité du service avant son départ.</p>`,
  },
  {
    id: 'decision-administrative-ltr',
    name: 'Décision administrative',
    category: 'PERSONNEL',
    icon: 'Shield',
    description: "Décision officielle nominative de l'administration.",
    allowedRoles: ['SUPER_ADMIN'],
    requiredInputs: [
      { key: 'staffId', type: 'staff', label: 'Agent concerné' },
      { key: 'objet',   type: 'text', label: 'Objet de la décision' },
      { key: 'corps',   type: 'textarea', label: 'Corps de la décision' },
    ],
    signatoryRoles: ['Directeur Général'],
    body: `<p><strong>Vu</strong> le règlement intérieur de l'Université de Référence ;</p>
<p><strong>Considérant</strong> {{objet}} ;</p>
<p><strong>DECIDE :</strong></p>
<p style="margin-left:24px;">{{corps}}</p>
<p>La présente décision concerne <strong>{{staff.fullName}}</strong>, <em>{{staff.function}}</em>,
et prend effet à compter de sa date de signature.</p>`,
  },
  {
    id: 'convocation-personnel-ltr',
    name: 'Convocation — Personnel',
    category: 'PERSONNEL',
    icon: 'Bell',
    description: 'Convoque un agent du personnel administratif.',
    allowedRoles: ['SUPER_ADMIN','SECRETAIRE'],
    requiredInputs: [
      { key: 'staffId', type: 'staff', label: 'Agent' },
      { key: 'date',    type: 'datetime-local', label: 'Date et heure' },
      { key: 'lieu',    type: 'text', label: 'Lieu' },
      { key: 'motif',   type: 'textarea', label: 'Motif' },
    ],
    signatoryRoles: ['Directeur Général'],
    body: `<p>Monsieur / Madame <strong>{{staff.fullName}}</strong>, <em>{{staff.function}}</em>,</p>
<p>Vous êtes prié(e) de vous présenter le <strong>{{date}}</strong> à <strong>{{lieu}}</strong>.</p>
<p><strong>Motif :</strong> {{motif}}</p>
<p>Votre présence est indispensable. En cas d'empêchement, veuillez nous en informer dans les plus brefs délais.</p>`,
  },
];

export function getLetterTemplate(id) {
  return LETTER_TEMPLATES.find((t) => t.id === id) ?? null;
}

export function getLetterTemplatesForRole(roleKey) {
  return LETTER_TEMPLATES.filter((t) => t.allowedRoles.includes(roleKey));
}
