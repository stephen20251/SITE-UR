import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, X, BookOpen, Layers, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRequireClassroom } from "@/components/classroom/shared";
import { useMentions, useSemesters, useSubjects, useTeachingUnits, useCreateSubject, useUpdateSubject, useCreateTeachingUnit } from "@/lib/academic";
import type { Subject, TeachingUnit } from "@/lib/academic";

export const Route = createFileRoute("/classroom/config/matieres")({ component: MatieresPage });

type Tab = "matieres" | "ue";

const inp = "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-classroom/30 transition";
const sel = `${inp} cursor-pointer`;

// ─── Create Subject Modal ─────────────────────────────────────────────────────
function CreateSubjectModal({
  mentionId,
  teachingUnits,
  onClose,
}: {
  mentionId: string;
  teachingUnits: TeachingUnit[];
  onClose: () => void;
}) {
  const create = useCreateSubject();
  const [form, setForm] = useState({
    code: "", name: "", credits: 3, weeklyHours: 2, description: "", teachingUnitId: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({
        mentionId,
        code: form.code,
        name: form.name,
        credits: form.credits,
        weeklyHours: form.weeklyHours,
        description: form.description || undefined,
        teachingUnitId: form.teachingUnitId || undefined,
      });
      toast.success("Matière créée");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Nouvelle matière</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Code</label>
              <input className={inp} placeholder="INF101" value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Crédits</label>
              <input className={inp} type="number" min={1} max={30} value={form.credits}
                onChange={(e) => setForm((f) => ({ ...f, credits: +e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Intitulé</label>
            <input className={inp} placeholder="Algorithmique et structures de données" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Heures/sem.</label>
              <input className={inp} type="number" step={0.5} min={0.5} value={form.weeklyHours}
                onChange={(e) => setForm((f) => ({ ...f, weeklyHours: +e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">UE (optionnel)</label>
              <select className={sel} value={form.teachingUnitId}
                onChange={(e) => setForm((f) => ({ ...f, teachingUnitId: e.target.value }))}>
                <option value="">— Aucune —</option>
                {teachingUnits.map((u) => (
                  <option key={u.id} value={u.id}>{u.code} – {u.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Description (optionnel)</label>
            <textarea className="h-20 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-classroom/30 transition"
              value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <button type="submit" disabled={create.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Créer la matière
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Create UE Modal ──────────────────────────────────────────────────────────
function CreateUEModal({
  mentionId,
  semesters,
  onClose,
}: {
  mentionId: string;
  semesters: { id: string; name: string; number: number }[];
  onClose: () => void;
}) {
  const create = useCreateTeachingUnit();
  const [form, setForm] = useState({ semesterId: "", code: "", name: "", credits: 6 });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ mentionId, ...form, credits: form.credits });
      toast.success("UE créée");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Nouvelle unité d'enseignement</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Semestre</label>
            <select className={sel} value={form.semesterId}
              onChange={(e) => setForm((f) => ({ ...f, semesterId: e.target.value }))} required>
              <option value="">Choisir un semestre</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>S{s.number} — {s.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Code</label>
              <input className={inp} placeholder="UE1" value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Crédits</label>
              <input className={inp} type="number" min={1} max={30} value={form.credits}
                onChange={(e) => setForm((f) => ({ ...f, credits: +e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Intitulé</label>
            <input className={inp} placeholder="Fondamentaux de l'informatique" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <button type="submit" disabled={create.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Créer l'UE
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Subject Row ──────────────────────────────────────────────────────────────
function SubjectRow({ s }: { s: Subject }) {
  const update = useUpdateSubject();

  async function toggleActive() {
    try {
      await update.mutateAsync({ id: s.id, isActive: !s.isActive });
      toast.success(s.isActive ? "Matière désactivée" : "Matière réactivée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <tr className="border-t hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <span className="rounded-md bg-classroom/10 px-2 py-0.5 text-xs font-mono font-semibold text-classroom">
          {s.code}
        </span>
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="font-medium">{s.name}</div>
        {s.mention && <div className="text-xs text-muted-foreground">{s.mention.name}</div>}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{s.teachingUnit?.name ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-center tabular-nums">{s.credits} cr.</td>
      <td className="px-4 py-3 text-sm text-center tabular-nums">{s.weeklyHours}h</td>
      <td className="px-4 py-3">
        <button
          onClick={toggleActive}
          disabled={update.isPending}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
            s.isActive
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400"
              : "bg-muted text-muted-foreground hover:bg-muted/70"
          }`}
        >
          {s.isActive ? "Active" : "Inactive"}
        </button>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function MatieresPage() {
  const { user, ready } = useRequireClassroom(["SUPER_ADMIN"]);
  const [tab, setTab] = useState<Tab>("matieres");
  const [mentionId, setMentionId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [showCreateSubject, setShowCreateSubject] = useState(false);
  const [showCreateUE, setShowCreateUE] = useState(false);

  const mentions = useMentions();
  const semesters = useSemesters();
  const subjects = useSubjects(mentionId || undefined);
  const teachingUnits = useTeachingUnits(mentionId || undefined, semesterId || undefined);

  if (!ready || !user) return null;

  const allSemesters = semesters.data ?? [];
  const allMentions = mentions.data ?? [];
  const allSubjects = subjects.data ?? [];
  const allUEs = teachingUnits.data ?? [];

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          <button
            onClick={() => setTab("matieres")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              tab === "matieres" ? "bg-white dark:bg-gray-800 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen size={13} /> Matières
          </button>
          <button
            onClick={() => setTab("ue")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              tab === "ue" ? "bg-white dark:bg-gray-800 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers size={13} /> Unités d'enseignement
          </button>
        </div>
        <button
          onClick={() => tab === "matieres" ? setShowCreateSubject(true) : setShowCreateUE(true)}
          className="inline-flex items-center gap-2 rounded-xl grad-classroom px-4 py-2 text-sm font-semibold text-white shadow-elegant"
        >
          <Plus size={14} /> {tab === "matieres" ? "Nouvelle matière" : "Nouvelle UE"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <select
            className="h-9 rounded-xl border bg-background pl-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-classroom/30 transition appearance-none"
            value={mentionId}
            onChange={(e) => setMentionId(e.target.value)}
          >
            <option value="">Toutes les mentions</option>
            {allMentions.map((m) => (
              <option key={m.id} value={m.id}>{m.code} — {m.name}</option>
            ))}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>
        {tab === "ue" && (
          <div className="relative">
            <select
              className="h-9 rounded-xl border bg-background pl-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-classroom/30 transition appearance-none"
              value={semesterId}
              onChange={(e) => setSemesterId(e.target.value)}
            >
              <option value="">Tous les semestres</option>
              {allSemesters.map((s) => (
                <option key={s.id} value={s.id}>S{s.number} — {s.name}</option>
              ))}
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* ── Matières table ── */}
      {tab === "matieres" && (
        <div className="rounded-2xl border bg-card shadow-elegant overflow-hidden">
          <div className="border-b px-5 py-3 flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              {allSubjects.length} matière{allSubjects.length !== 1 ? "s" : ""}
              {mentionId && allMentions.find((m) => m.id === mentionId) && (
                <span className="ml-2 text-muted-foreground font-normal">
                  — {allMentions.find((m) => m.id === mentionId)!.name}
                </span>
              )}
            </h3>
          </div>
          {subjects.isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : allSubjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">Aucune matière</p>
              <p className="mt-1 text-sm text-muted-foreground/60">
                {mentionId ? "Aucune matière pour cette mention." : "Commencez par sélectionner une mention ou créez la première matière."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Intitulé</th>
                    <th className="px-4 py-3">UE</th>
                    <th className="px-4 py-3 text-center">Crédits</th>
                    <th className="px-4 py-3 text-center">Heures/sem.</th>
                    <th className="px-4 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {allSubjects.map((s) => (
                    <SubjectRow key={s.id} s={s} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── UE table ── */}
      {tab === "ue" && (
        <div className="rounded-2xl border bg-card shadow-elegant overflow-hidden">
          <div className="border-b px-5 py-3">
            <h3 className="font-semibold text-sm">
              {allUEs.length} UE
              {mentionId && allMentions.find((m) => m.id === mentionId) && (
                <span className="ml-2 text-muted-foreground font-normal">
                  — {allMentions.find((m) => m.id === mentionId)!.name}
                </span>
              )}
            </h3>
          </div>
          {teachingUnits.isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : allUEs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Layers className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">Aucune UE définie</p>
              <p className="mt-1 text-sm text-muted-foreground/60">
                Sélectionnez une mention ou créez la première unité d'enseignement.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Intitulé</th>
                    <th className="px-4 py-3 text-center">Crédits</th>
                    <th className="px-4 py-3 text-center">Matières</th>
                  </tr>
                </thead>
                <tbody>
                  {allUEs.map((u) => (
                    <tr key={u.id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-mono font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                          {u.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{u.name}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground tabular-nums">{u.credits} cr.</td>
                      <td className="px-4 py-3 text-center text-muted-foreground tabular-nums">
                        {u.subjects?.length ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showCreateSubject && mentionId && (
        <CreateSubjectModal
          mentionId={mentionId}
          teachingUnits={allUEs}
          onClose={() => setShowCreateSubject(false)}
        />
      )}
      {showCreateSubject && !mentionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-2xl text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="font-semibold">Sélectionnez une mention</p>
            <p className="mt-1 text-sm text-muted-foreground">Une matière appartient à une mention. Filtrez d'abord.</p>
            <button onClick={() => setShowCreateSubject(false)} className="mt-4 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-accent">
              Fermer
            </button>
          </div>
        </div>
      )}
      {showCreateUE && mentionId && (
        <CreateUEModal
          mentionId={mentionId}
          semesters={allSemesters}
          onClose={() => setShowCreateUE(false)}
        />
      )}
      {showCreateUE && !mentionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-2xl text-center">
            <Layers className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="font-semibold">Sélectionnez une mention</p>
            <p className="mt-1 text-sm text-muted-foreground">Une UE appartient à une mention. Filtrez d'abord.</p>
            <button onClick={() => setShowCreateUE(false)} className="mt-4 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-accent">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
