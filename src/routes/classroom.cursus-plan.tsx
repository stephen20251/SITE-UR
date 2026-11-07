import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, GraduationCap, Plus, Trash2 } from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";
import {
  Bar, Card, CourseStatusBadge, Empty, Loading, PageHeader, Tabs, btnPrimary, inputCls,
} from "@/components/classroom/cursus-ui";
import { SupervisionTable } from "@/components/classroom/supervision";
import {
  LEVELS, useCurriculum, useCurriculumMutations, useCurriculumOptions, usePassage, usePromote,
  type CurriculumEntry, type CurriculumOptions,
} from "@/lib/cursus";
import { ApiError } from "@/lib/api";
import { semesterLabel } from "@/lib/cursus";

export const Route = createFileRoute("/classroom/cursus-plan")({ component: CursusPlan });

type Tab = "PLAN" | "SUPERVISION" | "PASSAGE";

function CursusPlan() {
  const { user, ready } = useRequireClassroom(["STAFF", "SUPER_ADMIN"]);
  const [tab, setTab] = useState<Tab>("PLAN");
  const [mentionId, setMentionId] = useState("");
  const [level, setLevel] = useState("L1");
  const options = useCurriculumOptions(mentionId || undefined);

  useEffect(() => {
    if (!mentionId && options.data?.mentions[0]) setMentionId(options.data.mentions[0].id);
  }, [options.data, mentionId]);

  if (!ready || !user) return <Loading />;
  if (options.isError) return <Empty>Accès réservé aux Responsables de mention.</Empty>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cursus universitaire"
        subtitle="Créez le cursus, attribuez chaque cours à un enseignant et suivez son déroulement."
        actions={tab !== "SUPERVISION" && (
          <div className="flex gap-2">
            <select className={inputCls} value={mentionId} onChange={(e) => setMentionId(e.target.value)}>
              {(options.data?.mentions ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        )}
      />
      <Tabs<Tab> value={tab} onChange={setTab} items={[
        { v: "PLAN", label: "Plan du cursus" },
        { v: "SUPERVISION", label: "Déroulement des cours" },
        { v: "PASSAGE", label: "Passage au niveau supérieur" },
      ]} />
      {tab === "PLAN" && mentionId && options.data && <PlanTab mentionId={mentionId} level={level} options={options.data} />}
      {tab === "SUPERVISION" && <SupervisionTable />}
      {tab === "PASSAGE" && mentionId && <PassageTab mentionId={mentionId} level={level} />}
    </div>
  );
}

// ─── Plan : 8 mois, 2 à 4 cours par mois ─────────────────────────────────────
function PlanTab({ mentionId, level, options }: { mentionId: string; level: string; options: CurriculumOptions }) {
  const plan = useCurriculum(mentionId, level);
  if (plan.isLoading) return <Loading />;
  if (!plan.data) return <Empty>Impossible de charger le plan.</Empty>;
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {plan.data.total} cours planifiés en {level}. {semesterLabel(level, 1)} = mois 1 à 4 (≈ 12 matières), {semesterLabel(level, 2)} = mois 5 à 8.
        Chaque mois compte 2 à 4 cours.
      </p>
      {[1, 2].map((sem) => (
        <div key={sem} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{semesterLabel(level, sem)}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {plan.data!.months.filter((m) => m.semester === sem).map((m) => (
              <Card key={m.month}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Mois {m.month}</h3>
                  <span className="text-xs text-muted-foreground">{m.entries.length}/4 cours</span>
                </div>
                {m.warning && <p className="mt-1 flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="h-3 w-3" />{m.warning}</p>}
                <div className="mt-3 space-y-2">
                  {m.entries.map((e) => <EntryRow key={e.id} e={e} options={options} />)}
                </div>
                {m.entries.length < 4 && <AddEntry mentionId={mentionId} level={level} month={m.month} options={options} />}
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EntryRow({ e, options }: { e: CurriculumEntry; options: CurriculumOptions }) {
  const { update, remove } = useCurriculumMutations();
  const save = (patch: Record<string, unknown>) =>
    update.mutateAsync({ id: e.id, ...patch })
      .then(() => toast.success("Cursus mis à jour"))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Échec"));

  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium">{e.title}</div>
          <div className="text-xs text-muted-foreground">{e.subject?.name ?? "Sans matière"} · {e.plannedHours} h</div>
        </div>
        <button
          onClick={() => { if (confirm(`Retirer « ${e.title} » du cursus ?`)) remove.mutate(e.id); }}
          className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950" title="Retirer du cursus"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          className={`${inputCls} h-8 text-xs`}
          value={e.teacher?.id ?? ""}
          onChange={(ev) => save({ teacherId: ev.target.value || null })}
          title="Enseignant attribué"
        >
          <option value="">— Attribuer à un enseignant —</option>
          {options.teachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
        </select>
        {e.course ? (
          <span className="flex items-center gap-1.5 text-xs"><CourseStatusBadge status={e.course.progress.status} /> cours créé</span>
        ) : e.teacher ? (
          <span className="text-xs text-amber-600">en attente de création par l'enseignant</span>
        ) : null}
      </div>
      {e.course && <Bar value={e.course.progress.syllabusPct} className="mt-2" />}
    </div>
  );
}

function AddEntry({ mentionId, level, month, options }: { mentionId: string; level: string; month: number; options: CurriculumOptions }) {
  const { create } = useCurriculumMutations();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", subjectId: "", teacherId: "", plannedHours: 30 });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ mentionId, level, month, ...f, subjectId: f.subjectId || null, teacherId: f.teacherId || null });
      toast.success("Cours ajouté au cursus");
      setF({ title: "", subjectId: "", teacherId: "", plannedHours: 30 });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Ajout impossible");
    }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-classroom hover:underline">
      <Plus className="h-3.5 w-3.5" /> Ajouter un cours au mois {month}
    </button>
  );
  return (
    <form onSubmit={submit} className="mt-3 grid gap-2 rounded-xl border border-dashed p-3 sm:grid-cols-2">
      <input className={`${inputCls} sm:col-span-2`} placeholder="Intitulé du cours" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
      <select className={inputCls} value={f.subjectId} onChange={(e) => setF({ ...f, subjectId: e.target.value })}>
        <option value="">Matière (optionnel)</option>
        {options.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select className={inputCls} value={f.teacherId} onChange={(e) => setF({ ...f, teacherId: e.target.value })}>
        <option value="">Enseignant (optionnel)</option>
        {options.teachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
      </select>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">Volume horaire
        <input type="number" min={1} className={`${inputCls} w-20`} value={f.plannedHours} onChange={(e) => setF({ ...f, plannedHours: Number(e.target.value) })} /> h
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:underline">Annuler</button>
        <button className={btnPrimary} disabled={create.isPending}>Ajouter</button>
      </div>
    </form>
  );
}

// ─── Passage au niveau supérieur ─────────────────────────────────────────────
function PassageTab({ mentionId, level }: { mentionId: string; level: string }) {
  const q = usePassage(mentionId, level);
  const promote = usePromote();
  const [target, setTarget] = useState("");
  useEffect(() => { setTarget(q.data?.targetPromotions[0]?.id ?? ""); }, [q.data]);

  if (q.isLoading) return <Loading />;
  if (!q.data) return <Empty>Impossible de charger les étudiants.</Empty>;
  if (!q.data.nextLevel) return <Empty>{level} est le dernier niveau : pas de passage possible.</Empty>;

  const eligible = q.data.students.filter((s) => s.eligible);
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          Passage <b>{level} → {q.data.nextLevel}</b> · {eligible.length} étudiant{eligible.length > 1 ? "s" : ""} éligible{eligible.length > 1 ? "s" : ""} sur {q.data.students.length}
          <p className="text-xs text-muted-foreground">Éligible = 8 mois d'écolage payés et tous les cours terminés à 100 %. Vous pouvez aussi tenir compte des notes.</p>
        </div>
        <label className="text-xs text-muted-foreground">Promotion d'accueil
          <select className={`${inputCls} ml-2`} value={target} onChange={(e) => setTarget(e.target.value)}>
            {q.data.targetPromotions.length === 0 && <option value="">Aucune promotion {q.data.nextLevel}</option>}
            {q.data.targetPromotions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </Card>
      {q.data.students.length === 0 ? <Empty>Aucun étudiant en {level}.</Empty> : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-elegant">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr><th className="px-4 py-3">Étudiant</th><th className="px-4 py-3">Mois payés</th><th className="px-4 py-3">Mois terminés</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody>
              {q.data.students.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="px-4 py-3"><div className="font-medium">{s.user.lastName} {s.user.firstName}</div><div className="text-xs text-muted-foreground">{s.matricule}</div></td>
                  <td className="w-40 px-4 py-3"><div className="text-xs">{s.paidCount}/8</div><Bar value={(s.paidCount / 8) * 100} className="mt-1" /></td>
                  <td className="w-40 px-4 py-3"><div className="text-xs">{s.completedCount}/8</div><Bar value={(s.completedCount / 8) * 100} className="mt-1" /></td>
                  <td className="px-4 py-3 text-right">
                    {s.eligible ? (
                      <button
                        disabled={!target || promote.isPending}
                        onClick={() => promote.mutateAsync({ studentId: s.id, toPromotionId: target })
                          .then(() => toast.success(`${s.user.firstName} passe en ${q.data!.nextLevel}`))
                          .catch((err) => toast.error(err instanceof ApiError ? err.message : "Échec"))}
                        className={btnPrimary}
                      >
                        <GraduationCap className="h-4 w-4" /> Valider le passage
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">non éligible</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {eligible.length > 0 && (
        <p className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Chaque étudiant est notifié de son passage.</p>
      )}
    </div>
  );
}
