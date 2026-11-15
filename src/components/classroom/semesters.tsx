// Semestres du cursus en présentiel, propres à chaque mention : panneau d'un niveau
// (créer, renommer, choisir les mois, supprimer). Utilisé par « Cursus universitaire »
// et par la page « Semestres » (tous les niveaux, L1 → M2).
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Card, btnPrimary, inputCls } from "@/components/classroom/cursus-ui";
import { monthsRange, useSemesterMutations, type CursusSemester } from "@/lib/cursus";
import { ApiError } from "@/lib/api";

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

