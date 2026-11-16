// Semestres du cursus en présentiel, propres à chaque mention : panneau d'un niveau
// (créer, renommer, choisir les mois, supprimer). Utilisé par « Cursus universitaire »
// et par la page « Semestres » (tous les niveaux, L1 → M2).
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarRange, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Card, Empty, Loading, PageHeader, btnPrimary, inputCls } from "@/components/classroom/cursus-ui";
import { monthsRange, useSemesterMutations, type CursusSemester } from "@/lib/cursus";
import { api, ApiError } from "@/lib/api";

// ─── Semestres de la mention : créer, renommer, choisir les mois ─────────────
export function SemestersPanel({ mentionId, level, semesters }: { mentionId: string; level: string; semesters: CursusSemester[] }) {
  const { create, init, update, remove } = useSemesterMutations();
  const [adding, setAdding] = useState(false);
  const isDefault = semesters.length > 0 && semesters.every((s) => s.isDefault);
  const err = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Échec");
  const used = new Set(semesters.filter((s) => !s.isDefault).flatMap((s) => Array.from({ length: s.endMonth - s.startMonth + 1 }, (_, i) => s.startMonth + i)));
  const free = [1, 2, 3, 4, 5, 6, 7, 8].filter((m) => !used.has(m));

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Semestres — {level}</h3>
          <p className="text-xs text-muted-foreground">
            Propres à cette mention : nommez-les et choisissez leurs mois. Ils ne s'affichent pas dans les autres mentions.
          </p>
        </div>
        {isDefault ? (
          <button className={btnPrimary} disabled={init.isPending}
            onClick={() => init.mutateAsync({ mentionId, level }).then(() => toast.success("Semestres créés : vous pouvez les renommer")).catch(err)}>
            <Plus className="h-4 w-4" /> Personnaliser les semestres
          </button>
        ) : free.length > 0 && !adding && (
          <button className={btnPrimary} onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Nouveau semestre</button>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {semesters.map((s, i) => s.isDefault
          ? <div key={i} className="rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground">{s.name} · {monthsRange(s.startMonth, s.endMonth)} <span className="text-xs">(par défaut)</span></div>
          : <SemesterRow key={s.id} s={s}
              onSave={(b) => update.mutateAsync({ id: s.id!, ...b }).then(() => toast.success("Semestre enregistré")).catch(err)}
              onDelete={() => { if (confirm(`Supprimer le semestre « ${s.name} » ? Les cours restent dans leurs mois.`)) remove.mutateAsync(s.id!).then(() => toast.success("Semestre supprimé")).catch(err); }} />)}
        {adding && (
          <SemesterRow s={{ id: null, name: "", startMonth: free[0] ?? 1, endMonth: free[free.length - 1] ?? 8 }} editingInit
            onCancel={() => setAdding(false)}
            onSave={(b) => create.mutateAsync({ mentionId, level, ...b }).then(() => { setAdding(false); toast.success("Semestre créé"); }).catch(err)} />
        )}
        {!isDefault && free.length > 0 && <p className="text-xs text-amber-600">Mois sans semestre : {free.join(", ")}</p>}
      </div>
    </Card>
  );
}

export function SemesterRow({ s, onSave, onDelete, onCancel, editingInit = false }: {
  s: CursusSemester; editingInit?: boolean;
  onSave: (b: { name: string; startMonth: number; endMonth: number }) => Promise<unknown>;
  onDelete?: () => void; onCancel?: () => void;
}) {
  const [editing, setEditing] = useState(editingInit);
  const [name, setName] = useState(s.name);
  const [start, setStart] = useState(s.startMonth);
  const [end, setEnd] = useState(s.endMonth);
  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2">
        <div className="text-sm"><span className="font-medium">{s.name}</span> <span className="text-muted-foreground">· {monthsRange(s.startMonth, s.endMonth)}</span></div>
        <div className="flex gap-1">
          <button onClick={() => setEditing(true)} className="rounded p-1.5 hover:bg-accent" title="Modifier"><Pencil className="h-3.5 w-3.5" /></button>
          {onDelete && <button onClick={onDelete} className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950" title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>}
        </div>
      </div>
    );
  }
  const months = [1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border p-2">
      <input className={`${inputCls} min-w-40 flex-1`} placeholder="Nom (ex. Semestre 1, Semestre d'automne)" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <label className="flex items-center gap-1 text-xs text-muted-foreground">Du mois
        <select className={inputCls} value={start} onChange={(e) => setStart(Number(e.target.value))}>{months.map((m) => <option key={m}>{m}</option>)}</select>
      </label>
      <label className="flex items-center gap-1 text-xs text-muted-foreground">au mois
        <select className={inputCls} value={end} onChange={(e) => setEnd(Number(e.target.value))}>{months.map((m) => <option key={m}>{m}</option>)}</select>
      </label>
      <button className={btnPrimary} onClick={() => onSave({ name, startMonth: start, endMonth: end }).then(() => setEditing(false))}><Save className="h-4 w-4" /> Enregistrer</button>
      <button className="rounded-lg p-2 hover:bg-accent" title="Annuler" onClick={() => { setEditing(false); setName(s.name); setStart(s.startMonth); setEnd(s.endMonth); onCancel?.(); }}><X className="h-4 w-4" /></button>
    </div>
  );
}

type AllSemesters = {
  mention: { id: string; name: string; code: string };
  levels: { level: string; semesters: CursusSemester[] }[];
};

// Semestres du cursus en présentiel : chaque mention a les siens (S1 à S10 de L1 à M2
// par défaut), avec ses propres noms et ses propres mois. Le Super Admin choisit la
// mention ; un Responsable pédagogique ne voit que la sienne.
export function SemestresManager({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient();
  const mentions = useQuery({
    queryKey: ["structure", "mentions", "mine"],
    queryFn: () => api<{ id: string; name: string }[]>("/structure/mentions?mine=1"),
  });
  const [mentionId, setMentionId] = useState("");
  useEffect(() => {
    if (!mentionId && mentions.data?.[0]) setMentionId(mentions.data[0].id);
  }, [mentions.data, mentionId]);

  const all = useQuery({
    queryKey: ["cursus", "semesters-all", mentionId],
    queryFn: () => api<AllSemesters>(`/cursus/semesters/all?mentionId=${mentionId}`),
    enabled: !!mentionId,
  });
  const initAll = useMutation({
    mutationFn: () => api<AllSemesters>("/cursus/semesters/init-all", { method: "POST", body: { mentionId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cursus"] }); toast.success("Semestres S1 à S10 créés : renommez-les ou changez leurs mois"); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Échec"),
  });

  if (mentions.isLoading) return <Loading />;
  if (!mentions.data?.length) {
    return <Empty>Aucune mention n'est rattachée à votre compte : demandez au Super Admin de vous associer à votre mention.</Empty>;
  }
  const mentionName = mentions.data.find((m) => m.id === mentionId)?.name ?? "";
  const allDefault = all.data?.levels.every((l) => l.semesters.every((s) => s.isDefault)) ?? false;
  const count = all.data?.levels.reduce((n, l) => n + l.semesters.length, 0) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={embedded ? "Semestres des mentions" : "Semestres"}
        subtitle="Chaque mention organise ses propres semestres, de L1 à M2 : noms, mois couverts et cours. Ils ne s'affichent jamais dans une autre mention."
        actions={mentions.data.length > 1 && (
          <select className={inputCls} value={mentionId} onChange={(e) => setMentionId(e.target.value)} aria-label="Mention">
            {mentions.data.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
      />

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl grad-classroom text-white"><CalendarRange className="h-5 w-5" /></div>
          <div>
            <div className="font-semibold">Mention {mentionName}</div>
            <div className="text-xs text-muted-foreground">
              {count} semestre{count > 1 ? "s" : ""} · par défaut S1–S2 en L1, S3–S4 en L2, S5–S6 en L3, S7–S8 en M1, S9–S10 en M2
            </div>
          </div>
        </div>
        {allDefault && (
          <button className={btnPrimary} disabled={initAll.isPending} onClick={() => initAll.mutate()}>
            <Plus className="h-4 w-4" /> Créer les semestres S1 à S10 de cette mention
          </button>
        )}
      </Card>

      {all.isLoading ? <Loading /> : !all.data ? <Empty>Impossible de charger les semestres.</Empty> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {all.data.levels.map((l) => (
            <SemestersPanel key={l.level} mentionId={mentionId} level={l.level} semesters={l.semesters} />
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Les cours se placent dans les semestres depuis « Cursus universitaire » (chaque cours est rangé dans un mois du semestre ; l'écolage reste mensuel).
      </p>
    </div>
  );
}
