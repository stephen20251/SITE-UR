import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { DashShell, StatCard } from "@/components/dash-shell";
import {
  LayoutDashboard, BarChart3, Plus, Loader2, ExternalLink, User,
  BookOpen, ChevronRight, Check, Globe, Lock,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useMyCourses, useCreateCourse, type CourseCard } from "@/lib/online";
import { ApiError } from "@/lib/api";
import { useRequireOnline, StatusPill } from "@/components/online/shared";
import { usePublicCategories } from "@/lib/lms-admin";
import { CategorySelect, MentionSelect } from "@/components/online/category-select";
import { CursusFields, emptyCursus, cursusPayload, cursusIncomplete, type CursusValue } from "@/components/online/cursus-fields";

export const Route = createFileRoute("/online/teacher")({ component: TeacherDash });

const ITEMS = [
  { to: "/online/teacher", label: "Studio", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/online", label: "Catalogue", icon: <BarChart3 className="h-4 w-4" /> },
  { to: "/online/profile", label: "Mon profil", icon: <User className="h-4 w-4" /> },
];

function TeacherDash() {
  const { user, ready } = useRequireOnline("TEACHER_ONLINE");
  const { logout } = useAuth();
  const navigate = useNavigate();
  const courses = useMyCourses(undefined, { enabled: ready && !!user });
  const [wizardOpen, setWizardOpen] = useState(false);

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Chargement…</div>;
  }

  const items = courses.data?.items ?? [];
  const published = items.filter((c) => c.status === "PUBLISHED").length;
  const totalStudents = items.reduce((s, c) => s + c._count.enrollments, 0);
  const drafts = items.filter((c) => c.status === "DRAFT").length;
  const chartData = [...items]
    .sort((a, b) => b._count.enrollments - a._count.enrollments)
    .slice(0, 6)
    .map((c) => ({ name: c.title.length > 14 ? c.title.slice(0, 13) + "…" : c.title, v: c._count.enrollments }));

  function openStudio(c: CourseCard) {
    navigate({ to: "/online/studio/$id", params: { id: c.id } });
  }

  return (
    <DashShell
      brand="Online"
      brandColor="online"
      items={ITEMS}
      user={{ name: `${user.firstName} ${user.lastName}`, role: "Enseignant" }}
      onLogout={async () => { await logout(); navigate({ to: "/online" }); }}
    >
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Mon Studio</h1>
            <p className="text-muted-foreground">Créez des cours, construisez le programme, suivez les statistiques.</p>
          </div>
          <button
            onClick={() => setWizardOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg grad-online px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Créer un cours
          </button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Cours" value={String(items.length)} hint={`${drafts} brouillon${drafts === 1 ? "" : "s"}`} accent="online" />
          <StatCard label="Publiés" value={String(published)} accent="success" />
          <StatCard label="Étudiants" value={totalStudents.toLocaleString()} accent="warning" />
          <StatCard label="Quiz" value={String(items.reduce((s, c) => s + c._count.quizzes, 0))} />
        </div>

        {/* Enrollments chart */}
        {chartData.length > 0 && (
          <div className="rounded-2xl border bg-card p-6 shadow-elegant">
            <h3 className="text-sm font-medium text-muted-foreground">Inscriptions par cours</h3>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} className="text-muted-foreground" />
                  <YAxis stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} className="text-muted-foreground" />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                  <Bar dataKey="v" fill="var(--color-online)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Course list */}
        <div className="rounded-2xl border bg-card shadow-elegant">
          <div className="flex items-center justify-between border-b p-5">
            <h3 className="font-semibold">Mes cours</h3>
            {courses.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {courses.isLoading ? (
            <div className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-4 p-16 text-center">
              <div className="rounded-full bg-online/10 p-5">
                <BookOpen className="h-8 w-8 text-online" />
              </div>
              <div>
                <p className="font-medium">Aucun cours pour l'instant</p>
                <p className="mt-1 text-sm text-muted-foreground">Cliquez sur <span className="font-medium text-foreground">Créer un cours</span> pour commencer.</p>
              </div>
              <button onClick={() => setWizardOpen(true)}
                className="flex items-center gap-2 rounded-lg grad-online px-4 py-2 text-sm font-medium text-white">
                <Plus className="h-4 w-4" /> Créer mon premier cours
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="text-left border-b">
                    <th className="p-4">Cours</th>
                    <th className="p-4">Étudiants</th>
                    <th className="p-4">Modules</th>
                    <th className="p-4">Quiz</th>
                    <th className="p-4">Statut</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-muted/20 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {c.thumbnail ? (
                            <img src={`http://localhost:4000${c.thumbnail}`} alt=""
                              className="h-10 w-16 shrink-0 rounded-lg object-cover" />
                          ) : (
                            <div className="h-10 w-16 shrink-0 rounded-lg bg-gradient-to-br from-online/20 to-online/5 grid place-items-center">
                              <BookOpen className="h-4 w-4 text-online/50" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium truncate max-w-[220px]">{c.title}</div>
                            {c.subtitle && <div className="text-xs text-muted-foreground truncate max-w-[220px]">{c.subtitle}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">{c._count.enrollments}</td>
                      <td className="p-4">{c._count.modules}</td>
                      <td className="p-4">{c._count.quizzes}</td>
                      <td className="p-4"><StatusPill status={c.status} /></td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => openStudio(c)}
                          className="inline-flex items-center gap-1.5 rounded-lg grad-online px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Ouvrir le Studio
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Creation wizard */}
      {wizardOpen && (
        <CourseWizard
          onClose={() => setWizardOpen(false)}
          onCreated={(id) => {
            setWizardOpen(false);
            navigate({ to: "/online/studio/$id", params: { id } });
          }}
        />
      )}
    </DashShell>
  );
}

// ── Creation wizard ────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

interface WizardForm {
  title: string;
  subtitle: string;
  description: string;
  language: string;
  level: string;
  categoryId: string;
  mentionId: string;
  hasCertificate: boolean;
  price: number;
  estimatedHours: string;
  cursus: CursusValue;
}

function CourseWizard({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (courseId: string) => void;
}) {
  const create = useCreateCourse();
  const { data: categories = [] } = usePublicCategories();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<WizardForm>({
    title: "", subtitle: "", description: "",
    language: "fr", level: "", categoryId: "",
    mentionId: "", hasCertificate: true, price: 0, estimatedHours: "",
    cursus: emptyCursus,
  });

  const set = (k: keyof WizardForm, v: string | boolean | number | CursusValue) =>
    setForm(p => ({ ...p, [k]: v }));

  // Flatten category tree for select
  const flatCats = categories.flatMap(c => [
    c,
    ...(c.children ?? []),
  ]);

  const step1Ok = form.title.trim().length >= 3;
  const step2Ok = true;
  const step3Ok = !cursusIncomplete(form.cursus);

  async function handleCreate() {
    try {
      const course = await create.mutateAsync({
        title:          form.title.trim(),
        subtitle:       form.subtitle.trim() || undefined,
        description:    form.description.trim() || undefined,
        language:       form.language,
        level:          form.level || undefined,
        categoryId:     form.categoryId || undefined,
        mentionId:      form.mentionId || undefined,
        hasCertificate: form.cursus.courseKind === "UNIVERSITY" ? false : form.hasCertificate,
        estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : undefined,
        ...cursusPayload(form.cursus),
      });
      toast.success("Cours créé ! Bienvenue dans le Studio.");
      onCreated(course.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur lors de la création");
    }
  }

  const STEPS = [
    { n: 1, label: "Informations" },
    { n: 2, label: "Classement" },
    { n: 3, label: "Paramètres" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-card shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="text-base font-semibold">Créer un cours</h2>
            <p className="text-xs text-muted-foreground">Étape {step} / 3 — {STEPS[step - 1].label}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-accent">
            ✕
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-0 border-b">
          {STEPS.map(({ n, label }) => (
            <div key={n} className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs border-b-2 transition
              ${step === n
                ? "border-online text-online font-medium"
                : step > n
                ? "border-green-500 text-green-600"
                : "border-transparent text-muted-foreground"}`}>
              {step > n
                ? <Check className="h-3.5 w-3.5" />
                : <span className={`h-4 w-4 rounded-full grid place-items-center text-[10px] font-semibold
                    ${step === n ? "bg-online text-white" : "bg-muted text-muted-foreground"}`}>{n}</span>}
              {label}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && <WizardStep1 form={form} set={set} />}
          {step === 2 && <WizardStep2 form={form} set={set} flatCats={flatCats} />}
          {step === 3 && <WizardStep3 form={form} set={set} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t p-4">
          <button
            onClick={() => step > 1 ? setStep(s => (s - 1) as Step) : onClose()}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-accent"
          >
            {step === 1 ? "Annuler" : "Retour"}
          </button>
          <div className="flex items-center gap-3">
            {step < 3 ? (
              <button
                onClick={() => setStep(s => (s + 1) as Step)}
                disabled={(step === 1 && !step1Ok) || (step === 2 && !form.mentionId)}
                className="flex items-center gap-2 rounded-lg grad-online px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Suivant <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={create.isPending || !step1Ok || !step3Ok}
                className="flex items-center gap-2 rounded-lg grad-online px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {create.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Création…</>
                  : <><Check className="h-4 w-4" /> Créer et ouvrir le Studio</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inp = "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

function WizardStep1({ form, set }: { form: WizardForm; set: (k: keyof WizardForm, v: any) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Titre du cours *</label>
        <input value={form.title} onChange={e => set("title", e.target.value)}
          className={inp} placeholder="Ex : React 18 de zéro à expert" autoFocus />
        {form.title.trim().length > 0 && form.title.trim().length < 3 && (
          <p className="mt-1 text-xs text-destructive">Minimum 3 caractères</p>
        )}
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Sous-titre</label>
        <input value={form.subtitle} onChange={e => set("subtitle", e.target.value)}
          className={inp} placeholder="Une phrase qui accroche et complète le titre" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Description (aperçu)</label>
        <textarea value={form.description} onChange={e => set("description", e.target.value)}
          rows={4} className={`${inp} h-auto py-2.5 resize-none`}
          placeholder="Décrivez brièvement ce que les apprenants vont apprendre. Vous pourrez compléter dans le Studio." />
        <p className="mt-1 text-xs text-muted-foreground">Vous pourrez rédiger une description complète depuis le Studio.</p>
      </div>
    </div>
  );
}

function WizardStep2({
  form, set, flatCats,
}: {
  form: WizardForm;
  set: (k: keyof WizardForm, v: any) => void;
  flatCats: Array<{ id: string; name: string; parentId?: string | null }>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Langue</label>
          <select value={form.language} onChange={e => set("language", e.target.value)} className={inp}>
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="mg">Malagasy</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Niveau</label>
          <select value={form.level} onChange={e => set("level", e.target.value)} className={inp}>
            <option value="">— Non spécifié —</option>
            <option value="BEGINNER">Débutant</option>
            <option value="INTERMEDIATE">Intermédiaire</option>
            <option value="ADVANCED">Avancé</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Mention <span className="text-destructive">*</span></label>
        <MentionSelect value={form.mentionId} onChange={(v) => set("mentionId", v)} className={inp} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Catégorie</label>
        <CategorySelect value={form.categoryId} onChange={(v) => set("categoryId", v)} className={inp} />
      </div>
    </div>
  );
}

function WizardStep3({ form, set }: { form: WizardForm; set: (k: keyof WizardForm, v: any) => void }) {
  const university = form.cursus.courseKind === "UNIVERSITY";
  return (
    <div className="space-y-5">
      {/* Cursus universitaire / cours certifiant */}
      <CursusFields value={form.cursus} onChange={(v) => set("cursus", v)} />
      {cursusIncomplete(form.cursus) && (
        <p className="text-xs text-amber-600">Précisez le niveau et le mois du cursus pour créer le cours.</p>
      )}

      {/* Certificate */}
      {!university && <div className="flex items-start gap-3 rounded-xl border p-4">
        <input type="checkbox" checked={form.hasCertificate} id="cert"
          onChange={e => set("hasCertificate", e.target.checked)} className="mt-0.5 rounded" />
        <label htmlFor="cert" className="cursor-pointer">
          <div className="text-sm font-medium">Délivrer un {form.cursus.credentialType === "ATTESTATION" ? "attestation" : "certificat"}</div>
          <div className="text-xs text-muted-foreground">
            Les apprenants le reçoivent automatiquement après avoir terminé le cours et réussi le test.
          </div>
        </label>
      </div>}

      {/* Prix : géré par le Super Admin (Tarifs & packs) */}
      <p className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
        Le prix de vente de ce cours sera fixé par le Super Admin (il est gratuit tant qu'aucun prix n'est défini).
        {university && " Il s'applique aux non-étudiants : les étudiants de l'UR y accèdent par leur écolage."}
      </p>

      {/* Duration */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Durée estimée (heures)</label>
        <input type="number" min={0} step={0.5} value={form.estimatedHours}
          onChange={e => set("estimatedHours", e.target.value)}
          className={`${inp} w-40`} placeholder="Ex : 12" />
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-dashed border-online/30 bg-online/5 p-4">
        <p className="text-xs font-medium text-online mb-2">Récapitulatif</p>
        <p className="text-sm font-semibold">{form.title || "—"}</p>
        {form.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{form.subtitle}</p>}
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {form.language && <span className="rounded-full bg-background border px-2 py-0.5">{form.language}</span>}
          {form.level && <span className="rounded-full bg-background border px-2 py-0.5">{form.level}</span>}
          <span className="rounded-full border bg-background px-2 py-0.5">
            {form.cursus.courseKind === "UNIVERSITY" ? "Universitaire" : form.cursus.courseKind === "BOTH" ? "Universitaire + certifiant" : "Certifiant"}
          </span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Après la création, vous serez redirigé vers le Studio pour ajouter l'image, les modules et les leçons.
        </p>
      </div>
    </div>
  );
}
