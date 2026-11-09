import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft, BookOpen, Briefcase, CheckCircle2, ClipboardCheck, Crown, FileText, GraduationCap, Home, Lightbulb,
  MonitorPlay, Printer, School, ShieldCheck, UserPlus, Users, Wallet,
} from "lucide-react";

// Guide d'utilisation : un cahier par profil, imprimable (Ctrl+P → PDF).
type Search = { role?: string };

export const Route = createFileRoute("/guide")({
  validateSearch: (s: Record<string, unknown>): Search => ({ role: typeof s.role === "string" ? s.role : undefined }),
  head: () => ({ meta: [{ title: "Guide d'utilisation — Université Références" }] }),
  component: GuidePage,
});

type Section = { title: string; steps: string[] };
type RoleGuide = {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  who: string;
  access: string[];
  sections: Section[];
  tips?: string[];
};

// Connexion commune à l'espace université
const ACCESS_UNIV = [
  "Ouvrez le site, puis cliquez sur « Espace numérique » (ou « Mon espace ») en haut à droite.",
  "Choisissez « Classroom System » (espace université).",
  "Saisissez l'adresse e-mail et le mot de passe fournis par l'université.",
];
const PROFILE_STEPS: Section = {
  title: "Mon profil",
  steps: [
    "Cliquez sur votre nom ou votre photo en haut à droite, puis « Mon profil ».",
    "« Ajouter une photo » : choisissez une image JPEG, PNG ou WebP (5 Mo maximum).",
    "Bloc « Mes informations » → « Modifier » : complétez votre téléphone et les champs propres à votre rôle, puis « Enregistrer ».",
    "Le nom et l'adresse e-mail sont gérés par l'administration : pour les corriger, contactez le secrétariat.",
    "« Changer mon mot de passe » : remplacez le mot de passe provisoire reçu par e-mail. Mot de passe oublié ? Sur la page de connexion, « Mot de passe oublié ? » envoie un lien valable 1 heure.",
  ],
};
const COMMS: Section = {
  title: "Messages, annonces et notifications",
  steps: [
    "« Messages » : discutez avec vos enseignants, vos collègues ou l'administration.",
    "« Annonces » : informations officielles de l'université (examens, événements, réunions…).",
    "« Notifications » : alertes personnelles (paiement validé, cours approuvé, nouvelle note…). Un compteur rouge indique les non-lues.",
  ],
};

const GUIDES: RoleGuide[] = [
  {
    id: "candidat",
    label: "Candidat",
    Icon: UserPlus,
    who: "Toute personne qui souhaite s'inscrire à l'Université Références.",
    access: [
      "Sur la page d'accueil, cliquez sur « Déposer ma candidature » (section Formation ou Contact).",
      "Créez votre compte : nom, e-mail, téléphone, mot de passe, niveau visé et mention souhaitée.",
    ],
    sections: [
      {
        title: "Constituer et suivre son dossier",
        steps: [
          "Une fois connecté, ouvrez « Ma candidature ».",
          "Complétez les informations demandées et joignez les pièces justificatives.",
          "Soumettez le dossier : son statut passe à « Soumis », puis « En cours d'examen ».",
          "Le secrétariat des admissions étudie votre dossier. Vous êtes notifié de la décision.",
          "En cas d'acceptation, le secrétariat finalise votre inscription : votre compte devient un compte étudiant.",
        ],
      },
    ],
    tips: ["Vous pouvez explorer les cours en ligne pendant l'examen de votre dossier : les cours du cursus restent visibles mais ne sont accessibles qu'aux étudiants inscrits."],
  },
  {
    id: "etudiant",
    label: "Étudiant",
    Icon: GraduationCap,
    who: "Étudiant inscrit dans une mention (Licence ou Master).",
    access: ACCESS_UNIV,
    sections: [
      {
        title: "Le cursus mois par mois",
        steps: [
          "L'année compte 8 mois de cours ; chaque mois regroupe 2 à 4 matières de votre semestre (S1, S2…).",
          "« Mes cours » affiche les mois : un mois est « Accessible » quand son écolage est payé, sinon « Non accessible ».",
          "Le mois suivant s'ouvre quand l'écolage du mois en cours est payé et que vos cours du mois sont terminés à 100 %.",
          "Les cours se suivent aussi depuis UR Online (« Espace numérique » → « Online System ») avec le même compte.",
          "Les contenus sont protégés : ils se consultent sur la plateforme et ne se téléchargent pas.",
        ],
      },
      {
        title: "Écolage et paiements",
        steps: [
          "« Paiements » : consultez les mois payés, les montants restants et l'historique.",
          "Payez en ligne, ou à la caisse de l'université (guichet écolage) : le secrétariat enregistre alors votre paiement.",
          "Dès que le paiement est validé, le mois correspondant devient accessible.",
        ],
      },
      {
        title: "Scolarité au quotidien",
        steps: [
          "« Emploi du temps » : vos séances de la semaine (salle, enseignant, horaire).",
          "« Mes notes » et « Mon bulletin » : vos résultats par matière et votre moyenne.",
          "« Présences » : votre assiduité ; les absences sont relevées par le Responsable Présence.",
          "« Documents » : attestations et documents officiels mis à votre disposition.",
        ],
      },
      COMMS,
      PROFILE_STEPS,
    ],
    tips: ["Terminez chaque leçon jusqu'au bout : c'est la progression à 100 % qui débloque le mois suivant."],
  },
  {
    id: "parent",
    label: "Parent",
    Icon: Users,
    who: "Parent ou tuteur d'un étudiant, avec un compte relié à son enfant par l'université.",
    access: ACCESS_UNIV,
    sections: [
      {
        title: "Suivre son enfant",
        steps: [
          "Le « Tableau de bord » présente chaque enfant : moyenne, assiduité et factures en attente.",
          "Consultez la progression dans le cursus mois par mois et les cours terminés.",
          "« Paiements » : situation de l'écolage de chaque enfant et paiements restants.",
          "« Corps enseignant » : les professeurs et docteurs de l'université, leur parcours et leur CV.",
        ],
      },
      COMMS,
      { ...PROFILE_STEPS, steps: [...PROFILE_STEPS.steps.slice(0, 2), "« Mes informations » → « Modifier » : téléphone, profession et lien de parenté.", PROFILE_STEPS.steps[3]] },
    ],
    tips: ["Si votre enfant n'apparaît pas, demandez au secrétariat de relier vos deux comptes."],
  },
  {
    id: "enseignant",
    label: "Enseignant",
    Icon: BookOpen,
    who: "Enseignant de l'université (cours en amphithéâtre et contenus en ligne).",
    access: ACCESS_UNIV,
    sections: [
      {
        title: "Premiers pas",
        steps: [
          "Ouvrez « Mon profil » et ajoutez votre photo.",
          "« Mes informations » → « Modifier » : choisissez votre mention de rattachement (le département et la faculté se remplissent automatiquement), votre spécialisation, votre bureau et une courte présentation.",
          "Votre mention détermine le Responsable qui validera vos cours en ligne.",
        ],
      },
      {
        title: "Mon CV et mon dossier académique",
        steps: [
          "« Mon CV et mon profil » : indiquez votre titre (Professeur ou Docteur), votre diplôme le plus élevé et vos années d'expérience.",
          "Déposez votre CV en PDF (10 Mo maximum) ; « Remplacer le CV » met en ligne une nouvelle version et retire l'ancienne.",
          "Avec un titre et un CV, votre fiche apparaît dans « Corps enseignant », visible uniquement par les étudiants inscrits et leurs parents.",
        ],
      },
      {
        title: "Mes cours et emploi du temps",
        steps: [
          "« Mes cours » : les matières que le Responsable de mention vous a attribuées dans le cursus.",
          "« Emploi du temps » : vos séances. « Mes disponibilités » : indiquez vos créneaux pour la préparation des plannings.",
        ],
      },
      {
        title: "Créer un cours en ligne (Studio)",
        steps: [
          "Allez dans UR Online → « Studio », puis « Créer un cours ».",
          "Étape Informations : titre, sous-titre, mention (obligatoire) et catégorie. Si la catégorie n'existe pas, choisissez « Autre… » et saisissez-la.",
          "Choisissez le type : Cursus universitaire, Certifiant ou les deux.",
          "Onglet « Modules & Leçons » : ajoutez Module 1, Module 2… puis les leçons (vidéo, texte, document, quiz ou « Lien URL » pour une vidéo YouTube).",
          "Onglet « Devoirs » : créez un devoir avec date limite et note, et joignez vos fichiers d'exercices.",
          "Quand le cours est prêt, soumettez-le : il passe « En révision ».",
        ],
      },
      {
        title: "Validation et rémunération",
        steps: [
          "Le cours est examiné par le Super administrateur ou le Responsable de votre mention.",
          "Approuvé, il est publié. Refusé, vous recevez un commentaire : corrigez puis soumettez de nouveau.",
          "Les revenus des cours certifiants payants sont partagés 50 % enseignant / 50 % université ; le suivi est assuré par la comptabilité.",
        ],
      },
      COMMS,
    ],
    tips: ["Une leçon « Lien URL » YouTube s'affiche directement dans le lecteur : vos étudiants n'ont pas à quitter la plateforme."],
  },
  {
    id: "responsable",
    label: "Responsable de mention",
    Icon: ShieldCheck,
    who: "Responsable d'une mention (ex. Responsable Info, Responsable Gestion) : chef de mention et responsable pédagogique.",
    access: ACCESS_UNIV,
    sections: [
      {
        title: "Construire le cursus",
        steps: [
          "« Cursus universitaire » : pour chaque niveau (L1, L2…), placez les matières dans les mois 1 à 8 (2 à 4 matières par mois), par semestre.",
          "« Affectation des matières » : attribuez chaque matière à un enseignant.",
          "« Emplois du temps » : préparez et validez les plannings de la mention.",
        ],
      },
      {
        title: "Valider les cours en ligne",
        steps: [
          "« Validation des cours » liste les cours de votre mention soumis par les enseignants.",
          "Ouvrez le cours, parcourez modules et leçons, puis « Approuver » (publication) ou « Refuser » avec un commentaire.",
        ],
      },
      {
        title: "Suivi pédagogique",
        steps: [
          "« Suivi des cours » : avancement des séances et du syllabus par matière.",
          "« Notes » et « Bulletins » : saisie, contrôle et validation des résultats.",
          "Passage de niveau : validez le passage des étudiants qui remplissent les conditions.",
          "« Documents » et « Lettres » : documents officiels de la mention.",
        ],
      },
      COMMS,
      PROFILE_STEPS,
    ],
  },
  {
    id: "secretariat",
    label: "Secrétariat",
    Icon: FileText,
    who: "Secrétariat / administration : admissions, inscriptions, caisse et suivi.",
    access: ACCESS_UNIV,
    sections: [
      {
        title: "Admissions et inscriptions",
        steps: [
          "« Candidatures » : examinez les dossiers soumis, puis acceptez ou refusez.",
          "« Inscriptions » : inscrivez un candidat accepté ou un nouvel étudiant directement (mention, niveau, promotion).",
          "Choisissez le mode d'étude : Présentiel ou En ligne (modifiable ensuite avec le bouton « Modifier »). Les vidéos et les enregistrements du cursus sont réservés aux étudiants en ligne.",
          "« Cartes » : générez les cartes d'étudiant.",
        ],
      },
      {
        title: "Guichet écolage",
        steps: [
          "« Guichet écolage » : recherchez l'étudiant, sélectionnez le ou les mois payés en espèces et enregistrez.",
          "Le mois est débloqué immédiatement pour l'étudiant.",
        ],
      },
      {
        title: "Suivi",
        steps: [
          "« Présences » et « Suivi des cours » : contrôle des séances réalisées et du respect du syllabus.",
          "« Documents » et « Lettres » : attestations, certificats de scolarité et courriers avec signature.",
        ],
      },
      {
        title: "Événements de l'accueil",
        steps: [
          "« Événements » : cliquez sur « Nouvel événement », renseignez titre, date de début (et de fin), lieu, description et ajoutez une image.",
          "Cochez « Visible sur la page d'accueil » pour le publier : il apparaît dans la section « Actualité » du site.",
          "« Modifier », « Masquer » ou « Supprimer » à tout moment ; les événements passés restent affichés avec la mention « Passé ».",
        ],
      },
      COMMS,
      PROFILE_STEPS,
    ],
  },
  {
    id: "presence",
    label: "Responsable Présence",
    Icon: ClipboardCheck,
    who: "Personne chargée de l'appel et du suivi des séances.",
    access: ACCESS_UNIV,
    sections: [
      {
        title: "Faire l'appel",
        steps: [
          "« Présences » : choisissez la séance (date, promotion, matière).",
          "Marquez chaque étudiant Présent, Absent ou En retard, puis enregistrez.",
          "Les taux d'assiduité sont mis à jour pour l'étudiant, ses parents et la mention.",
        ],
      },
      {
        title: "Suivi des cours",
        steps: ["« Suivi des cours » : indiquez si la séance a eu lieu et la partie du syllabus traitée."],
      },
      COMMS,
    ],
  },
  {
    id: "comptabilite",
    label: "Comptabilité",
    Icon: Wallet,
    who: "Service financier : écolage, finances étudiantes, personnel et salaires.",
    access: ACCESS_UNIV,
    sections: [
      {
        title: "Écolage",
        steps: [
          "« Écolage » : suivez les paiements par étudiant et par mois.",
          "Validez les paiements en ligne en attente et contrôlez les encaissements du guichet.",
          "« Finance Étudiante » : vue d'ensemble des factures, impayés et relances.",
        ],
      },
      {
        title: "Personnel et salaires",
        steps: [
          "« Personnel » : fiches du personnel et des enseignants.",
          "« Gestion des Salaires » : préparez la paie mensuelle et intégrez la part enseignant (50 %) des cours en ligne payants.",
        ],
      },
      COMMS,
      PROFILE_STEPS,
    ],
  },
  {
    id: "admin",
    label: "Super administrateur",
    Icon: Crown,
    who: "Administrateur de toute la plateforme (université et UR Online).",
    access: [...ACCESS_UNIV.slice(0, 2), "Connectez-vous avec le compte administrateur. Depuis UR Online, le lien « Administration » mène à l'administration de l'université, et inversement."],
    sections: [
      {
        title: "Mise en place de l'année",
        steps: [
          "« Configuration » : campus, facultés, départements, mentions et parcours.",
          "« Années universitaires » : créez l'année et ses semestres, puis marquez-la comme année en cours.",
          "« Tarifs & packs » et « Écolage » : montants de l'écolage.",
        ],
      },
      {
        title: "Comptes et rôles",
        steps: [
          "« Utilisateurs » : créez les comptes (enseignant, personnel, parent…) et attribuez les rôles (Responsable de mention, Secrétaire, Comptabilité, Responsable Présence).",
          "Laissez le mot de passe vide : la personne reçoit par e-mail son identifiant et un mot de passe provisoire. Seul un Super administrateur peut créer un autre Super administrateur.",
          "La fiche de profil est créée automatiquement : l'utilisateur complète ensuite sa photo et ses informations dans « Mon profil ».",
          "Bloquez, débloquez ou réinitialisez le mot de passe d'un compte si nécessaire.",
        ],
      },
      {
        title: "Pédagogie et UR Online",
        steps: [
          "Vous avez accès à tous les menus des responsables : cursus, affectation, validation des cours, notes, bulletins.",
          "UR Online → « Administration » : paramètres du site, logo, page d'accueil, catégories, cours, paiements, codes promo, abonnements, certificats et utilisateurs en ligne.",
        ],
      },
      {
        title: "Page Actualités du site",
        steps: [
          "« Actualités » : cliquez sur « Nouvelle actualité », choisissez la rubrique (actualité, annonce officielle, conférence, soutenance, publication, résultats, activités) et ajoutez une image.",
          "« À la une » choisit la grande actualité en tête de page. « Masquer » la retire du site.",
          "Une publication passe seule aux archives après 12 mois ; « Archiver » l'y place plus tôt.",
          "Les événements créés dans « Événements » apparaissent aussi sur cette page.",
        ],
      },
      {
        title: "Événements de l'accueil",
        steps: [
          "« Événements » : cliquez sur « Nouvel événement », renseignez titre, date de début (et de fin), lieu, description et ajoutez une image.",
          "Cochez « Visible sur la page d'accueil » pour le publier : il apparaît dans la section « Actualité » du site.",
          "« Modifier », « Masquer » ou « Supprimer » à tout moment ; les événements passés restent affichés avec la mention « Passé ».",
        ],
      },
      COMMS,
    ],
  },
  {
    id: "online",
    label: "Apprenant en ligne",
    Icon: MonitorPlay,
    who: "Personne extérieure qui suit des cours certifiants sur UR Online.",
    access: [
      "Cliquez sur « Espace numérique » puis « Online System ».",
      "Créez un compte (« S'inscrire ») ou connectez-vous.",
    ],
    sections: [
      {
        title: "Suivre un cours",
        steps: [
          "« Catalogue » : parcourez les cours ; l'étiquette indique le prix ou « Gratuit ».",
          "Les cours marqués « Cursus UR » sont réservés aux étudiants : cliquez dessus pour déposer une candidature.",
          "Inscrivez-vous au cours (paiement si nécessaire), puis suivez les leçons dans l'ordre.",
          "« Tableau de bord » : vos cours, votre progression et vos certificats.",
          "À 100 % de progression (et après réussite des quiz), votre certificat vérifiable est délivré.",
        ],
      },
      {
        title: "Mon profil",
        steps: ["« Mon profil » : photo et informations personnelles."],
      },
    ],
  },
];

const BASE_ICON = Briefcase;

function GuidePage() {
  const { role } = Route.useSearch();
  const current = GUIDES.find((g) => g.id === role) ?? GUIDES[0];
  const Icon = current.Icon ?? BASE_ICON;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 print:bg-white">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <button onClick={() => window.history.back()} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-100">
            <ArrowLeft className="h-4 w-4" /> Retour
          </button>
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-100">
            <Home className="h-4 w-4" /> Accueil
          </Link>
          <h1 className="ml-2 hidden font-semibold sm:block">Guide d'utilisation</h1>
          <button onClick={() => window.print()} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
            <Printer className="h-4 w-4" /> Imprimer / PDF
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[240px_1fr]">
        <nav className="print:hidden">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Je suis…</p>
          <div className="flex flex-wrap gap-2 lg:flex-col">
            {GUIDES.map((g) => (
              <Link
                key={g.id}
                to="/guide"
                search={{ role: g.id }}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${g.id === current.id ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"}`}
              >
                <g.Icon className="h-4 w-4 shrink-0" /> {g.label}
              </Link>
            ))}
          </div>
        </nav>

        <article className="min-w-0">
          <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 print:p-0 print:ring-0">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-red-50 text-red-600"><Icon className="h-6 w-6" /></span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Guide · Université Références</p>
                <h2 className="text-2xl font-bold">{current.label}</h2>
              </div>
            </div>
            <p className="mt-4 text-slate-600">{current.who}</p>

            <GuideBlock title="Se connecter" Icon={School} steps={current.access} />
            {current.sections.map((s) => <GuideBlock key={s.title} title={s.title} Icon={CheckCircle2} steps={s.steps} />)}

            {current.tips && (
              <div className="mt-8 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-800"><Lightbulb className="h-4 w-4" /> Bon à savoir</p>
                <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-amber-900">
                  {current.tips.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </div>
            )}

            <p className="mt-8 border-t pt-4 text-xs text-slate-500">
              Besoin d'aide ? Écrivez au secrétariat depuis « Messages » ou rendez-vous à l'accueil de l'université.
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}

function GuideBlock({ title, Icon, steps }: { title: string; Icon: React.ComponentType<{ className?: string }>; steps: string[] }) {
  return (
    <section className="mt-8 break-inside-avoid">
      <h3 className="flex items-center gap-2 text-lg font-semibold"><Icon className="h-5 w-5 text-red-600" /> {title}</h3>
      <ol className="mt-3 space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
