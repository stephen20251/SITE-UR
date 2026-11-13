import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle, ChevronDown, ChevronUp, Clock, Download, GraduationCap, Loader2, LogIn, Save, Send, XCircle } from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";
import { DocSlot } from "@/components/classroom/candidate-docs";
import { useAuth } from "@/lib/auth";
import {
  CANDIDATE_STATUS, useDossierMeta, useMyCandidature, usePublicMentions, useSaveInscription, useSaveMotivation,
  useSubmitInscription, useSubmitMyCandidature, useUpdateMyCandidature, type Candidate, type InscriptionForm,
} from "@/lib/candidatures";
import { ApiError } from "@/lib/api";

export const Route = createFileRoute("/classroom/candidat")({ component: CandidatDash });

// Parcours pour devenir étudiant de l'UR
const STEPS = [
  { key: "account",   label: "Compte candidat créé" },
  { key: "pre",       label: "Pré-inscription", hint: "Déposez vos pièces et répondez au questionnaire, puis soumettez." },
  { key: "review",    label: "Examen du dossier par le secrétariat", hint: "Le secrétariat vérifie vos pièces une par une." },
  { key: "inscription", label: "Inscription", hint: "Candidature acceptée : remplissez la fiche d'inscription et déposez les documents demandés." },
  { key: "validation", label: "Validation de l'inscription", hint: "Le secrétariat vérifie votre dossier d'inscription." },
  { key: "student",   label: "Étudiant(e) de l'UR" },
] as const;

function currentStep(c: Candidate) {
  if (c.status === "ENROLLED") return 5;
  if (c.status === "ACCEPTED") return c.inscriptionSubmittedAt ? 4 : 3;
  if (c.status === "SUBMITTED" || c.status === "UNDER_REVIEW") return 2;
  return 1;
}

const inp = "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-classroom/30 disabled:opacity-70";
const area = "min-h-20 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-classroom/30 disabled:opacity-70";
const card = "rounded-2xl border bg-card p-6 shadow-elegant";

function CandidatDash() {
  const { user, ready } = useRequireClassroom(["CANDIDATE"]);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const q = useMyCandidature(ready && !!user);
  const meta = useDossierMeta();

  if (!ready || !user || q.isLoading || meta.isLoading) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!q.data) return <p className="text-center text-muted-foreground">Aucune candidature trouvée pour ce compte.</p>;

  const c = q.data;
  const step = currentStep(c);
  const inscriptionStage = c.status === "ACCEPTED" || c.status === "ENROLLED";
  const inscriptionOpen = c.status === "ACCEPTED" && !c.inscriptionSubmittedAt;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      <div className="flex items-center gap-4 rounded-2xl border bg-card p-6 shadow-elegant">
        <img src="/logo-ur.jpg" alt="University Reference" className="h-14 w-14 rounded-xl object-cover" />
        <div className="flex-1">
          <h1 className="text-xl font-bold">Bienvenue, {user.firstName} !</h1>
          <p className="text-sm text-muted-foreground">Suivez et complétez votre dossier pour devenir étudiant(e) de l'University Reference.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${CANDIDATE_STATUS[c.status].cls}`}>{CANDIDATE_STATUS[c.status].label}</span>
      </div>

      {c.status === "ENROLLED" && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-sm text-emerald-800">
          <p className="font-semibold">Vous êtes officiellement étudiant(e) de l'UR ! 🎓</p>
          <p className="mt-1">Votre matricule figure dans vos notifications. Reconnectez-vous pour ouvrir votre espace étudiant.</p>
          <button onClick={async () => { await logout(); navigate({ to: "/classroom" }); }}
            className="mt-3 inline-flex items-center gap-2 rounded-lg grad-classroom px-4 py-2 font-medium text-white">
            <LogIn className="h-4 w-4" /> Se reconnecter
          </button>
        </div>
      )}
      {c.status === "REJECTED" && (
        <div className="flex gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <XCircle className="h-5 w-5 shrink-0" />
          <div><p className="font-semibold">Candidature non retenue</p><p>{c.rejectionReason ?? "Aucun motif précisé."} Vous pouvez corriger votre dossier et le soumettre à nouveau.</p></div>
        </div>
      )}

      {/* Pré-inscription validée : accès direct à la fiche d'inscription, sans défiler */}
      {inscriptionOpen && (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-900 sm:flex-row sm:items-center dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
          <CheckCircle className="h-8 w-8 shrink-0 text-emerald-600" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Pré-inscription validée : votre candidature est acceptée.</p>
            <p>Dernière étape : remplissez votre fiche d'inscription et déposez les documents demandés.</p>
          </div>
          <a href="#inscription" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg grad-classroom px-4 py-2.5 text-sm font-semibold text-white shadow-elegant">
            <GraduationCap className="h-4 w-4" /> Remplir ma fiche d'inscription
          </a>
        </div>
      )}

      {/* Progression (compacte) */}
      <div className={`${card} !p-5`}>
        <h2 className="mb-4 text-sm font-semibold">Progression de votre dossier</h2>
        <ol className="grid grid-cols-6 gap-1">
          {STEPS.map((st, i) => {
            const done = i < step || c.status === "ENROLLED";
            const current = i === step && c.status !== "ENROLLED";
            return (
              <li key={st.key} className="flex flex-col items-center text-center">
                <span className={`grid h-7 w-7 place-items-center rounded-full border-2 ${done ? "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40" : current ? "border-classroom text-classroom" : "border-muted text-muted-foreground"}`}>
                  {done ? <CheckCircle className="h-4 w-4" /> : current ? <Clock className="h-4 w-4" /> : <span className="text-[11px] font-semibold">{i + 1}</span>}
                </span>
                <span className={`mt-1.5 hidden text-[11px] leading-tight sm:block ${current ? "font-semibold text-classroom" : done ? "" : "text-muted-foreground"}`}>{st.label}</span>
              </li>
            );
          })}
        </ol>
        {c.status !== "ENROLLED" && (
          <p className="mt-4 rounded-xl bg-muted/40 px-3 py-2 text-xs">
            <span className="font-semibold">Étape {step + 1} sur {STEPS.length} — {STEPS[step].label}.</span>{" "}
            {(STEPS[step] as { hint?: string }).hint ?? ""}
          </p>
        )}
      </div>

      {/* Une fois la candidature acceptée, la fiche d'inscription passe en premier */}
      {inscriptionStage ? (
        <>
          <Inscription c={c} />
          <PreInscription c={c} />
        </>
      ) : (
        <PreInscription c={c} />
      )}
    </div>
  );
}

// ── Étape 1 : pré-inscription ────────────────────────────────────────────────
function PreInscription({ c }: { c: Candidate }) {
  const meta = useDossierMeta().data!;
  const mentions = usePublicMentions();
  const update = useUpdateMyCandidature();
  const saveMotivation = useSaveMotivation();
  const submit = useSubmitMyCandidature();
  const editable = c.status === "DRAFT" || c.status === "REJECTED";
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ mentionId: "", level: "L1", phone: "" });
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    setF({ mentionId: c.mention?.id ?? "", level: c.level ?? "L1", phone: c.user.phone ?? "" });
    setAnswers(c.motivation ?? {});
  }, [c.id, c.status]);

  const preTypes = Object.entries(meta.docTypes).filter(([, v]) => v.stage === "PRE_INSCRIPTION");

  async function saveAll() {
    await update.mutateAsync({ mentionId: f.mentionId, level: f.level, phone: f.phone });
    await saveMotivation.mutateAsync(answers);
  }
  async function save() {
    try { await saveAll(); toast.success("Dossier enregistré"); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : "Enregistrement impossible"); }
  }
  async function send() {
    try {
      await saveAll();
      await submit.mutateAsync();
      toast.success("Candidature soumise au secrétariat");
    } catch (err) { toast.error(err instanceof ApiError ? err.message : "Soumission impossible"); }
  }

  // Dossier soumis : la pré-inscription est close. Elle se résume en un cadre compact
  // (détail sur demande) pour laisser la place à l'étape suivante.
  if (!editable && !open) {
    const accepted = c.status === "ACCEPTED" || c.status === "ENROLLED";
    const preDocs = c.documents.filter((d) => preTypes.some(([t]) => t === d.type)).length;
    return (
      <div className={`${card} !p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${accepted ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40" : "bg-amber-100 text-amber-600 dark:bg-amber-950/40"}`}>
            {accepted ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">1. Pré-inscription {accepted ? "validée" : "clôturée"}</h2>
            <p className="text-xs text-muted-foreground">
              {accepted ? "Dossier accepté par le secrétariat" : "En cours d'examen par le secrétariat"}
              {c.submittedAt ? ` · soumis le ${new Date(c.submittedAt).toLocaleDateString("fr-FR")}` : ""}
              {" · "}{c.mention?.name ?? "—"} {c.level ?? ""} · {preDocs} pièce{preDocs > 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={() => setOpen(true)} className="inline-flex w-full items-center justify-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent sm:w-auto">
            <ChevronDown className="h-3.5 w-3.5" /> Voir le détail
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={card}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">1. Pré-inscription</h2>
        {!editable && (
          <button onClick={() => setOpen(false)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent">
            <ChevronUp className="h-3.5 w-3.5" /> Réduire
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted-foreground">Mention souhaitée
          <select className={`${inp} mt-1`} disabled={!editable} value={f.mentionId} onChange={(e) => setF({ ...f, mentionId: e.target.value })}>
            <option value="">Choisir…</option>
            {(mentions.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Niveau d'entrée
          <select className={`${inp} mt-1`} disabled={!editable} value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
            {["L1", "L2", "L3", "M1", "M2"].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Téléphone
          <input className={`${inp} mt-1`} disabled={!editable} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="034 00 000 00" />
        </label>
      </div>

      <h3 className="mt-6 text-sm font-semibold">Pièces à fournir</h3>
      <p className="text-xs text-muted-foreground">Formats acceptés : PDF, JPG, PNG ou Word — 10 Mo maximum par fichier.</p>
      <div className="mt-2 grid gap-2">
        {preTypes.map(([type, def]) => (
          <DocSlot key={type} type={type} label={def.label} required={def.required} maxFiles={def.maxFiles} hint={def.hint}
            docs={c.documents.filter((d) => d.type === type)} editable={editable} />
        ))}
      </div>

      <h3 className="mt-6 text-sm font-semibold">Questionnaire de motivation</h3>
      <div className="mt-2 space-y-3">
        {meta.questions.map((qq) => (
          <label key={qq.key} className="block text-xs text-muted-foreground">{qq.label}{qq.key !== "source" && <span className="text-red-500"> *</span>}
            <textarea className={`${area} mt-1`} disabled={!editable} value={answers[qq.key] ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [qq.key]: e.target.value }))} />
          </label>
        ))}
      </div>

      {editable && (
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={save} disabled={update.isPending || saveMotivation.isPending} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-accent">
            <Save className="h-4 w-4" /> Enregistrer
          </button>
          <button onClick={send} disabled={submit.isPending || update.isPending || !f.mentionId}
            className="inline-flex items-center gap-2 rounded-lg grad-classroom px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            <Send className="h-4 w-4" /> Soumettre ma candidature
          </button>
        </div>
      )}
    </div>
  );
}

// ── Étape 2 : inscription (après acceptation) ────────────────────────────────
const LANG_SKILLS = ["Français", "Anglais"] as const;

function Inscription({ c }: { c: Candidate }) {
  const meta = useDossierMeta().data!;
  const save = useSaveInscription();
  const submit = useSubmitInscription();
  const editable = c.status === "ACCEPTED" && !c.inscriptionSubmittedAt;
  const [form, setForm] = useState<InscriptionForm>({});
  const [paymentReference, setRef] = useState("");
  const [fromOtherSchool, setOther] = useState(false);

  useEffect(() => {
    setForm(c.inscriptionForm ?? { lastName: c.user.lastName.toUpperCase(), firstNames: c.user.firstName, nationality: "Malagasy" });
    setRef(c.paymentReference ?? "");
    setOther(c.fromOtherSchool);
  }, [c.id, c.inscriptionSubmittedAt]);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const val = (k: string) => String(form[k] ?? "");
  const field = (k: string, label: string, opts: { type?: string; required?: boolean; full?: boolean } = {}) => (
    <label className={`text-xs text-muted-foreground ${opts.full ? "sm:col-span-2" : ""}`}>{label}{opts.required && <span className="text-red-500"> *</span>}
      <input type={opts.type ?? "text"} className={`${inp} mt-1`} disabled={!editable} value={val(k)} onChange={(e) => set(k, e.target.value)} />
    </label>
  );

  async function doSave(silent = false) {
    await save.mutateAsync({ form, paymentReference, fromOtherSchool });
    if (!silent) toast.success("Dossier d'inscription enregistré");
  }
  async function send() {
    try {
      await doSave(true);
      await submit.mutateAsync();
      toast.success("Dossier d'inscription envoyé au secrétariat");
    } catch (err) { toast.error(err instanceof ApiError ? err.message : "Envoi impossible"); }
  }

  const insTypes = Object.entries(meta.docTypes).filter(([, v]) => v.stage === "INSCRIPTION" && (!v.otherSchool || fromOtherSchool));
  const templates: Record<string, { href: string; label: string }> = {
    ENGAGEMENT_PARENTAL: { href: "/modeles/lettre-engagement-parental.docx", label: "Télécharger un modèle" },
    DEMANDE_ADMISSION: { href: "/modeles/demande-admission.pdf", label: "Télécharger un modèle" },
  };

  return (
    <div id="inscription" className={`${card} scroll-mt-20`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">2. Inscription</h2>
        <a href="/modeles/fiche-inscription.docx" download className="inline-flex items-center gap-1 text-xs font-medium text-classroom hover:underline">
          <Download className="h-3 w-3" /> Fiche d'inscription (version papier)
        </a>
      </div>
      {c.inscriptionSubmittedAt && c.status === "ACCEPTED" && (
        <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
          Dossier envoyé le {new Date(c.inscriptionSubmittedAt).toLocaleDateString("fr-FR")}. Le secrétariat le vérifie : vous deviendrez étudiant(e) dès sa validation.
        </p>
      )}

      {/* Fiche d'inscription */}
      <h3 className="mt-5 text-sm font-semibold">Fiche d'inscription — 1. Candidat</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {field("lastName", "NOM", { required: true })}
        {field("firstNames", "Prénoms", { required: true })}
        {field("nationality", "Nationalité", { required: true })}
        <label className="text-xs text-muted-foreground">Sexe<span className="text-red-500"> *</span>
          <select className={`${inp} mt-1`} disabled={!editable} value={val("sex")} onChange={(e) => set("sex", e.target.value)}>
            <option value="">—</option><option value="M">Masculin</option><option value="F">Féminin</option>
          </select>
        </label>
        {field("address", "Adresse complète", { required: true, full: true })}
        {field("birthDate", "Date de naissance", { type: "date", required: true })}
        {field("birthPlace", "Lieu de naissance", { required: true })}
        <label className="text-xs text-muted-foreground">Statut matrimonial<span className="text-red-500"> *</span>
          <select className={`${inp} mt-1`} disabled={!editable} value={val("maritalStatus")} onChange={(e) => set("maritalStatus", e.target.value)}>
            <option value="">—</option>{["Célibataire", "Marié(e)", "Divorcé(e)", "Veuf / Veuve"].map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        {field("baccYear", "Année du BACC", { required: true })}
        {field("baccSerie", "Série", { required: true })}
        {field("baccMention", "Mention obtenue au BACC")}
      </div>

      <h3 className="mt-5 text-sm font-semibold">2. Activité de formation</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">Mention
          <input className={`${inp} mt-1`} disabled value={c.mention?.name ?? "—"} />
        </label>
        {field("parcours", "Parcours", { required: true })}
      </div>

      <h3 className="mt-5 text-sm font-semibold">Compétences linguistiques (1 = limité, 5 = très bon)</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {field("motherTongue", "Langue maternelle")}
        {field("otherLanguages", "Autres langues")}
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-muted-foreground"><th className="py-1 text-left">Langue</th><th>Expression orale</th><th>Compréhension</th><th>Expression écrite</th></tr></thead>
          <tbody>
            {LANG_SKILLS.map((l) => (
              <tr key={l}>
                <td className="py-1 font-medium">{l}</td>
                {["oral", "comprehension", "ecrit"].map((k) => (
                  <td key={k} className="px-1 text-center">
                    <select className="h-8 rounded-lg border bg-background px-2 text-xs disabled:opacity-70" disabled={!editable}
                      value={val(`lang_${l}_${k}`)} onChange={(e) => set(`lang_${l}_${k}`, e.target.value)}>
                      <option value="">—</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-5 text-sm font-semibold">Vie professionnelle (si applicable)</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {field("currentJob", "Emploi actuel")}
        {field("jobSince", "Depuis (date)", { type: "date" })}
        {field("employer", "Institution, organisation ou entreprise")}
        {field("employerAddress", "Adresse")}
        {field("supervisor", "Nom et adresse mail de votre supérieur", { full: true })}
      </div>

      <h3 className="mt-5 text-sm font-semibold">Déclaration personnelle<span className="text-red-500"> *</span></h3>
      <textarea className={`${area} mt-2 min-h-28`} disabled={!editable} value={val("personalStatement")} onChange={(e) => set("personalStatement", e.target.value)}
        placeholder="Pourquoi vous postulez à cette mention, ce que vous espérez en retirer, en quoi elle est bénéfique à votre développement…" />
      <label className="mt-3 block text-xs text-muted-foreground">Comment avez-vous eu connaissance de cette université ?
        <input className={`${inp} mt-1`} disabled={!editable} value={val("howKnown")} onChange={(e) => set("howKnown", e.target.value)} />
      </label>
      <label className="mt-3 flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-xs">
        <input type="checkbox" className="mt-0.5" disabled={!editable} checked={!!form.declarationAccepted} onChange={(e) => set("declarationAccepted", e.target.checked)} />
        <span>
          Je déclare que les renseignements et documents communiqués sont exacts et authentiques, que mon état de santé est compatible
          avec le programme d'études, et je m'engage à respecter le règlement intérieur de l'université.<span className="text-red-500"> *</span>
        </span>
      </label>

      {/* Paiement et pièces */}
      <h3 className="mt-6 text-sm font-semibold">Droit d'inscription</h3>
      <label className="mt-2 block text-xs text-muted-foreground">Référence de paiement du droit d'inscription<span className="text-red-500"> *</span>
        <input className={`${inp} mt-1`} disabled={!editable} value={paymentReference} onChange={(e) => setRef(e.target.value)} placeholder="Ex : référence MVola ou n° du reçu du bureau" />
      </label>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" disabled={!editable} checked={fromOtherSchool} onChange={(e) => setOther(e.target.checked)} />
        Je viens d'une autre école / université
      </label>

      <h3 className="mt-4 text-sm font-semibold">Documents à déposer</h3>
      <div className="mt-2 grid gap-2">
        {insTypes.map(([type, def]) => (
          <DocSlot key={type} type={type} label={def.label} required={def.required || def.otherSchool} maxFiles={def.maxFiles} hint={def.hint}
            docs={c.documents.filter((d) => d.type === type)} editable={editable} template={templates[type]} />
        ))}
      </div>

      {editable && (
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => doSave().catch((e) => toast.error(e instanceof ApiError ? e.message : "Erreur"))} disabled={save.isPending}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-accent">
            <Save className="h-4 w-4" /> Enregistrer
          </button>
          <button onClick={send} disabled={submit.isPending || save.isPending}
            className="inline-flex items-center gap-2 rounded-lg grad-classroom px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            <GraduationCap className="h-4 w-4" /> Envoyer mon dossier d'inscription
          </button>
        </div>
      )}
    </div>
  );
}
