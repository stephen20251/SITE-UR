import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Package, Pencil, Plus, Search, Tag, Trash2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireClassroom } from "@/components/classroom/shared";
import { Card, Empty, Loading, PageHeader, Tabs, btnPrimary, inputCls } from "@/components/classroom/cursus-ui";
import { fmtMGA } from "@/lib/cursus";

export const Route = createFileRoute("/classroom/tarifs")({ component: Tarifs });

type SellableCourse = {
  id: string; title: string; price: number | null; status: string; courseKind: string;
  teacher: { firstName: string; lastName: string } | null;
};
type Pack = {
  id: string; title: string; description: string | null; price: number; currency: string; isActive: boolean;
  individualTotal: number; saving: number;
  courses: { courseId: string; course: { id: string; title: string; price: number | null } }[];
};

const useCourses = () => useQuery({ queryKey: ["pricing", "courses"], queryFn: () => api<SellableCourse[]>("/online/pricing/courses") });
const usePacks = () => useQuery({ queryKey: ["pricing", "packs"], queryFn: () => api<Pack[]>("/online/pricing/packs") });

// Prix des cours et des packs — géré uniquement par le Super Admin
function Tarifs() {
  const { user, ready } = useRequireClassroom(["SUPER_ADMIN"]);
  const [tab, setTab] = useState<"COURSES" | "PACKS">("COURSES");
  if (!ready || !user) return <Loading />;
  return (
    <div className="space-y-6">
      <PageHeader title="Tarifs & packs" subtitle="Prix de vente des cours certifiants et des packs de cours (ex. Java I + II + III à prix réduit)." />
      <Tabs<"COURSES" | "PACKS"> value={tab} onChange={setTab} items={[{ v: "COURSES", label: "Prix des cours" }, { v: "PACKS", label: "Packs de cours" }]} />
      {tab === "COURSES" ? <CoursePrices /> : <Packs />}
    </div>
  );
}

function CoursePrices() {
  const qc = useQueryClient();
  const courses = useCourses();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: ({ id, price }: { id: string; price: number }) => api(`/online/pricing/courses/${id}/price`, { method: "PATCH", body: { price } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pricing"] }); toast.success("Prix enregistré"); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erreur"),
  });

  if (courses.isLoading) return <Loading />;
  const list = (courses.data ?? []).filter((c) => !q || c.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <Card className="p-0">
      <div className="flex items-center gap-2 border-b p-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un cours…" className="flex-1 bg-transparent text-sm outline-none" />
      </div>
      {list.length === 0 ? <div className="p-6"><Empty>Aucun cours vendable (certifiant ou « les deux »).</Empty></div> : (
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <th className="px-4 py-2">Cours</th><th className="px-4 py-2">Enseignant</th><th className="px-4 py-2">Type</th><th className="px-4 py-2 text-right">Prix (MGA)</th><th className="w-24" />
          </tr></thead>
          <tbody>
            {list.map((c) => {
              const edit = editing[c.id];
              return (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{c.title} {c.status !== "PUBLISHED" && <span className="text-xs text-muted-foreground">(brouillon)</span>}</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.teacher ? `${c.teacher.lastName} ${c.teacher.firstName}` : "—"}</td>
                  <td className="px-4 py-2 text-xs">{c.courseKind === "BOTH" ? "Universitaire + certifiant" : "Certifiant"}</td>
                  <td className="px-4 py-2 text-right">
                    {edit !== undefined ? (
                      <input type="number" min={0} autoFocus value={edit} onChange={(e) => setEditing((s) => ({ ...s, [c.id]: e.target.value }))}
                        className={`${inputCls} w-32 text-right`} />
                    ) : (c.price ?? 0) > 0 ? fmtMGA(c.price) : <span className="text-muted-foreground">Gratuit</span>}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {edit !== undefined ? (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => { save.mutate({ id: c.id, price: Number(edit) || 0 }); setEditing(({ [c.id]: _, ...rest }) => rest); }}
                          className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"><Check className="h-4 w-4" /></button>
                        <button onClick={() => setEditing(({ [c.id]: _, ...rest }) => rest)} className="rounded-lg p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <button onClick={() => setEditing((s) => ({ ...s, [c.id]: String(c.price ?? 0) }))} className="rounded-lg p-1.5 hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function Packs() {
  const qc = useQueryClient();
  const packs = usePacks();
  const [form, setForm] = useState<Partial<Pack> & { courseIds?: string[] } | null>(null);
  const del = useMutation({
    mutationFn: (id: string) => api(`/online/pricing/packs/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pricing", "packs"] }); toast.success("Pack supprimé"); },
  });
  const toggle = useMutation({
    mutationFn: (p: Pack) => api(`/online/pricing/packs/${p.id}`, { method: "PUT", body: { isActive: !p.isActive } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing", "packs"] }),
  });

  if (packs.isLoading) return <Loading />;
  return (
    <div className="space-y-4">
      <button onClick={() => setForm({ title: "", price: 0, courseIds: [] })} className={btnPrimary}><Plus className="h-4 w-4" /> Nouveau pack</button>
      {form && <PackForm initial={form} onClose={() => setForm(null)} />}
      {(packs.data ?? []).length === 0 && !form && <Empty>Aucun pack. Créez par exemple « Java I + II + III » à un prix avantageux.</Empty>}
      <div className="grid gap-3 md:grid-cols-2">
        {(packs.data ?? []).map((p) => (
          <Card key={p.id}>
            <div className="flex items-start gap-3">
              <Package className="mt-0.5 h-5 w-5 text-classroom" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{p.title}</h3>
                  {!p.isActive && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">désactivé</span>}
                </div>
                {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                <ul className="mt-2 space-y-0.5 text-sm">
                  {p.courses.map((c) => <li key={c.courseId} className="flex justify-between"><span>• {c.course.title}</span><span className="text-xs text-muted-foreground">{fmtMGA(c.course.price ?? 0)}</span></li>)}
                </ul>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-lg font-bold text-classroom">{fmtMGA(p.price, p.currency)}</span>
                  <span className="text-xs text-muted-foreground line-through">{fmtMGA(p.individualTotal, p.currency)}</span>
                  {p.saving > 0 && <span className="flex items-center gap-1 text-xs text-emerald-600"><Tag className="h-3 w-3" /> −{fmtMGA(p.saving, p.currency)}</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => setForm({ ...p, courseIds: p.courses.map((c) => c.courseId) })} className="rounded-lg p-1.5 hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => toggle.mutate(p)} className="rounded-lg px-1.5 text-[10px] hover:bg-accent">{p.isActive ? "Désactiver" : "Activer"}</button>
                <button onClick={() => confirm(`Supprimer le pack « ${p.title} » ?`) && del.mutate(p.id)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PackForm({ initial, onClose }: { initial: Partial<Pack> & { courseIds?: string[] }; onClose: () => void }) {
  const qc = useQueryClient();
  const courses = useCourses();
  const [title, setTitle] = useState(initial.title ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [price, setPrice] = useState(String(initial.price ?? 0));
  const [ids, setIds] = useState<string[]>(initial.courseIds ?? []);
  const save = useMutation({
    mutationFn: () => {
      const body = { title, description, price: Number(price) || 0, courseIds: ids };
      return initial.id
        ? api(`/online/pricing/packs/${initial.id}`, { method: "PUT", body })
        : api("/online/pricing/packs", { method: "POST", body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pricing", "packs"] }); toast.success("Pack enregistré"); onClose(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erreur"),
  });
  const list = courses.data ?? [];
  const sum = list.filter((c) => ids.includes(c.id)).reduce((s, c) => s + (c.price ?? 0), 0);

  return (
    <Card className="space-y-3 border-classroom/30">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{initial.id ? "Modifier le pack" : "Nouveau pack"}</h3>
        <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={inputCls} placeholder="Titre (ex : Pack Java I + II + III)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className={inputCls} type="number" min={0} placeholder="Prix du pack (MGA)" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <input className={`${inputCls} w-full`} placeholder="Description (optionnel)" value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
      <div>
        <p className="mb-1 text-xs text-muted-foreground">Cours inclus ({ids.length}) — prix à l'unité cumulé : {fmtMGA(sum)}</p>
        <div className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border p-2 sm:grid-cols-2">
          {list.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-accent">
              <input type="checkbox" checked={ids.includes(c.id)} onChange={(e) => setIds((s) => e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id))} />
              <span className="flex-1 truncate">{c.title}</span>
              <span className="text-xs text-muted-foreground">{fmtMGA(c.price ?? 0)}</span>
            </label>
          ))}
        </div>
      </div>
      <button onClick={() => save.mutate()} disabled={save.isPending || ids.length < 2 || !title.trim()} className={btnPrimary}>
        <Check className="h-4 w-4" /> Enregistrer
      </button>
      {ids.length < 2 && <p className="text-xs text-amber-600">Sélectionnez au moins 2 cours.</p>}
    </Card>
  );
}
