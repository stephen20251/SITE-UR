import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, ChevronRight, Building2, BookOpen, GraduationCap, X, Pencil, Trash2, ImageIcon } from "lucide-react";
import { MentionEditor } from "@/components/classroom/mention-editor";
import { mediaUrl } from "@/components/online/mooc-card";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import {
  useFaculties, useDepartments, useMentions, useParcours,
  useCreateFaculty, useCreateDepartment, useCreateMention, useCreateParcours,
  type Mention,
} from "@/lib/academic";

export const Route = createFileRoute("/classroom/config/structure")({ component: StructurePage });

// ─── Outils communs ───────────────────────────────────────────────────────────

const inp = "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-classroom/30 transition";
const errorText = (e: unknown) => (e instanceof ApiError ? e.message : "Action impossible. Réessayez dans un instant.");

type Field = { key: string; label: string; placeholder?: string; type?: "text" | "number" | "select"; options?: { value: string; label: string }[]; required?: boolean };

// Fenêtre de saisie (création ou modification).
function FormDialog({ title, fields, initial, submitLabel = "Créer", onSubmit, onClose, loading }: {
  title: string;
  fields: Field[];
  initial?: Record<string, string>;
  submitLabel?: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
  loading: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, initial?.[f.key] ?? f.options?.[0]?.value ?? ""]))
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try { await onSubmit(values); } catch (err) { toast.error(errorText(err)); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1.5 block text-sm font-medium">
                {f.label}{f.required !== false && <span className="ml-0.5 text-red-500">*</span>}
              </label>
              {f.type === "select" ? (
                <select className={inp} value={values[f.key]} required={f.required !== false}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input type={f.type ?? "text"} className={inp} placeholder={f.placeholder} value={values[f.key]}
                  required={f.required !== false} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold hover:bg-accent">Annuler</button>
            <button type="submit" disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modification et suppression d'un élément de la structure.
type Kind = "faculties" | "departments" | "mentions" | "parcours";
function useStructureActions(kind: Kind) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["academic"] });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api(`/structure/${kind}/${id}`, { method: "PUT", body: data }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/structure/${kind}/${id}`, { method: "DELETE" }),
    onSuccess: () => { refresh(); toast.success("Supprimé"); },
    onError: (e) => toast.error(errorText(e)),
  });
  const confirmRemove = (id: string, name: string) => {
    if (confirm(`Supprimer « ${name} » ?\n\nIl n'apparaîtra plus sur la plateforme ni sur le site. L'historique (étudiants, notes…) est conservé.`)) remove.mutate(id);
  };
  return { update, remove, confirmRemove };
}

function RowActions({ onEdit, onDelete, deleting }: { onEdit: () => void; onDelete: () => void; deleting?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-accent">
        <Pencil size={12} /> Modifier
      </button>
      <button onClick={onDelete} disabled={deleting} aria-label="Supprimer" title="Supprimer"
        className="grid h-[30px] w-[30px] place-items-center rounded-lg border text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30">
        {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
      </button>
    </div>
  );
}

function SectionCard({ icon, title, count, tools, children }: { icon: ReactNode; title: string; count: number; tools: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-elegant">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold">{title}</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{count}</span>
        </div>
        <div className="flex items-center gap-2">{tools}</div>
      </div>
      <div className="divide-y">{children}</div>
    </div>
  );
}

const AddButton = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-xl grad-classroom px-3 py-1.5 text-xs font-semibold text-white">
    <Plus size={13} /> Ajouter
  </button>
);
const Loading = () => <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
const Empty = ({ children }: { children: ReactNode }) => <div className="py-10 text-center text-sm text-muted-foreground">{children}</div>;
const filterSelect = "h-8 max-w-[11rem] rounded-lg border bg-background px-2 text-xs outline-none";

// ─── Sections ─────────────────────────────────────────────────────────────────

function FacultiesSection() {
  const { data: faculties, isLoading } = useFaculties();
  const create = useCreateFaculty();
  const { update, remove, confirmRemove } = useStructureActions("faculties");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; code: string; deanName: string | null } | null>(null);

  const fields: Field[] = [
    { key: "name", label: "Nom de la faculté", placeholder: "ex : Sciences de l'Ingénieur" },
    { key: "code", label: "Code", placeholder: "ex : FAC-ST" },
    { key: "deanName", label: "Nom du doyen (facultatif)", placeholder: "ex : Pr Rakoto", required: false },
  ];

  return (
    <SectionCard icon={<Building2 size={18} className="text-classroom" />} title="Facultés" count={faculties?.length ?? 0}
      tools={<AddButton onClick={() => setOpen(true)} />}>
      {isLoading ? <Loading /> : (faculties?.length ?? 0) === 0 ? <Empty>Aucune faculté : créez la première.</Empty> : (
        faculties!.map((f) => (
          <div key={f.id} className="flex items-center gap-3 px-5 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-classroom/10">
              <Building2 size={15} className="text-classroom" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{f.name}</p>
              <p className="text-xs text-muted-foreground">{f.code}{f.deanName ? ` · ${f.deanName}` : ""}</p>
            </div>
            <RowActions onEdit={() => setEditing(f)} onDelete={() => confirmRemove(f.id, f.name)}
              deleting={remove.isPending && remove.variables === f.id} />
          </div>
        ))
      )}
      {open && (
        <FormDialog title="Nouvelle faculté" fields={fields} loading={create.isPending} onClose={() => setOpen(false)}
          onSubmit={async (v) => {
            await create.mutateAsync({ name: v.name, code: v.code, campusId: "", deanName: v.deanName || undefined });
            toast.success(`Faculté « ${v.name} » créée`);
            setOpen(false);
          }} />
      )}
      {editing && (
        <FormDialog title="Modifier la faculté" submitLabel="Enregistrer" fields={fields} loading={update.isPending}
          initial={{ name: editing.name, code: editing.code, deanName: editing.deanName ?? "" }} onClose={() => setEditing(null)}
          onSubmit={async (v) => {
            await update.mutateAsync({ id: editing.id, data: { name: v.name, code: v.code, deanName: v.deanName } });
            toast.success("Faculté enregistrée");
            setEditing(null);
          }} />
      )}
    </SectionCard>
  );
}

function DepartmentsSection() {
  const { data: faculties } = useFaculties();
  const { data: departments, isLoading } = useDepartments();
  const create = useCreateDepartment();
  const { update, remove, confirmRemove } = useStructureActions("departments");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; code: string; headName: string | null; facultyId: string } | null>(null);
  const [filterFacId, setFilterFacId] = useState<string>("all");

  const filtered = departments?.filter((d) => filterFacId === "all" || d.facultyId === filterFacId) ?? [];
  const fields: Field[] = [
    { key: "facultyId", label: "Faculté", type: "select", options: faculties?.map((f) => ({ value: f.id, label: f.name })) ?? [] },
    { key: "name", label: "Nom du département", placeholder: "ex : Département Informatique" },
    { key: "code", label: "Code", placeholder: "ex : DEPT-INFO" },
    { key: "headName", label: "Chef de département (facultatif)", placeholder: "ex : Dr Randrianasolo", required: false },
  ];

  return (
    <SectionCard icon={<Building2 size={18} className="text-indigo-600" />} title="Départements" count={departments?.length ?? 0}
      tools={<>
        <select className={filterSelect} value={filterFacId} onChange={(e) => setFilterFacId(e.target.value)}>
          <option value="all">Toutes les facultés</option>
          {faculties?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <AddButton onClick={() => setOpen(true)} />
      </>}>
      {isLoading ? <Loading /> : filtered.length === 0 ? <Empty>Aucun département.</Empty> : (
        filtered.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-5 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/40">
              <Building2 size={15} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{d.name}</p>
              <p className="truncate text-xs text-muted-foreground">{d.code} · {d.faculty?.name}{d.headName ? ` · ${d.headName}` : ""}</p>
            </div>
            <RowActions onEdit={() => setEditing(d)} onDelete={() => confirmRemove(d.id, d.name)}
              deleting={remove.isPending && remove.variables === d.id} />
          </div>
        ))
      )}
      {open && (
        <FormDialog title="Nouveau département" fields={fields} loading={create.isPending} onClose={() => setOpen(false)}
          onSubmit={async (v) => {
            await create.mutateAsync({ name: v.name, code: v.code, facultyId: v.facultyId, headName: v.headName || undefined });
            toast.success(`Département « ${v.name} » créé`);
            setOpen(false);
          }} />
      )}
      {editing && (
        <FormDialog title="Modifier le département" submitLabel="Enregistrer" fields={fields} loading={update.isPending}
          initial={{ facultyId: editing.facultyId, name: editing.name, code: editing.code, headName: editing.headName ?? "" }}
          onClose={() => setEditing(null)}
          onSubmit={async (v) => {
            await update.mutateAsync({ id: editing.id, data: { facultyId: v.facultyId, name: v.name, code: v.code, headName: v.headName } });
            toast.success("Département enregistré");
            setEditing(null);
          }} />
      )}
    </SectionCard>
  );
}

function MentionsSection() {
  const { data: departments } = useDepartments();
  const { data: mentions, isLoading } = useMentions();
  const create = useCreateMention();
  const { update, remove, confirmRemove } = useStructureActions("mentions");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Mention | null>(null);
  const [moving, setMoving] = useState<Mention | null>(null);
  const [filterDeptId, setFilterDeptId] = useState<string>("all");

  const filtered = mentions?.filter((m) => filterDeptId === "all" || m.departmentId === filterDeptId) ?? [];
  // Présentation publique renseignée ? (fenêtre de détail de l'accueil)
  const presented = (m: Mention) => [m.tagline, m.description, m.objectives, m.skills, m.careers, m.admission].filter((v) => v?.trim()).length;
  const LEVELS = ["Licence", "Master", "Doctorat"];
  const deptOptions = departments?.map((d) => ({ value: d.id, label: d.name })) ?? [];

  return (
    <SectionCard icon={<BookOpen size={18} className="text-violet-600" />} title="Mentions" count={mentions?.length ?? 0}
      tools={<>
        <select className={filterSelect} value={filterDeptId} onChange={(e) => setFilterDeptId(e.target.value)}>
          <option value="all">Tous les départements</option>
          {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <AddButton onClick={() => setOpen(true)} />
      </>}>
      {isLoading ? <Loading /> : filtered.length === 0 ? <Empty>Aucune mention.</Empty> : (
        filtered.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:flex-nowrap">
            {/* Photo affichée sur l'accueil : cliquer pour la changer */}
            <button onClick={() => setEditing(m)} title="Changer la photo et la présentation"
              className="relative h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-violet-100 ring-1 ring-black/5 dark:bg-violet-950/40">
              {m.imageUrl
                ? <img src={mediaUrl(m.imageUrl)} alt="" className="h-full w-full object-cover" />
                : <span className="grid h-full w-full place-items-center text-violet-600 dark:text-violet-400"><ImageIcon size={16} /></span>}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{m.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {m.code} · {m.level} · {m.duration} an{(m.duration ?? 0) > 1 ? "s" : ""}
                {" · "}
                <button onClick={() => setMoving(m)} className="underline-offset-2 hover:text-foreground hover:underline" title="Changer de département">
                  {m.department?.name}
                </button>
              </p>
            </div>
            <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium md:inline-flex ${presented(m) >= 3 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"}`}
              title="Contenu affiché sur la page d'accueil au clic sur la mention">
              {presented(m) >= 3 ? "Présentation complète" : "Présentation à compléter"}
            </span>
            <RowActions onEdit={() => setEditing(m)} onDelete={() => confirmRemove(m.id, m.name)}
              deleting={remove.isPending && remove.variables === m.id} />
          </div>
        ))
      )}
      {editing && <MentionEditor mention={editing} onClose={() => setEditing(null)} />}
      {moving && (
        <FormDialog title={`Département de « ${moving.name} »`} submitLabel="Enregistrer" loading={update.isPending}
          fields={[{ key: "departmentId", label: "Département", type: "select", options: deptOptions }]}
          initial={{ departmentId: moving.departmentId }} onClose={() => setMoving(null)}
          onSubmit={async (v) => {
            await update.mutateAsync({ id: moving.id, data: { departmentId: v.departmentId } });
            toast.success("Mention déplacée");
            setMoving(null);
          }} />
      )}
      {open && (
        <FormDialog title="Nouvelle mention" loading={create.isPending} onClose={() => setOpen(false)}
          fields={[
            { key: "departmentId", label: "Département", type: "select", options: deptOptions },
            { key: "name", label: "Nom de la mention", placeholder: "ex : Informatique" },
            { key: "code", label: "Code", placeholder: "ex : M-INFO" },
            { key: "level", label: "Niveau", type: "select", options: LEVELS.map((l) => ({ value: l, label: l })) },
            { key: "duration", label: "Durée (années)", type: "number", placeholder: "3" },
          ]}
          onSubmit={async (v) => {
            await create.mutateAsync({
              name: v.name, code: v.code, departmentId: v.departmentId,
              level: v.level, duration: parseInt(v.duration) || 3,
            });
            toast.success(`Mention « ${v.name} » créée : cliquez sur Modifier pour ajouter sa photo et sa présentation`);
            setOpen(false);
          }} />
      )}
    </SectionCard>
  );
}

function ParcoursSection() {
  const { data: mentions } = useMentions();
  const { data: parcours, isLoading } = useParcours();
  const create = useCreateParcours();
  const { update, remove, confirmRemove } = useStructureActions("parcours");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; code: string; description: string | null; mentionId: string } | null>(null);
  const [filterMentionId, setFilterMentionId] = useState<string>("all");

  const filtered = parcours?.filter((p) => filterMentionId === "all" || p.mentionId === filterMentionId) ?? [];
  const fields: Field[] = [
    { key: "mentionId", label: "Mention", type: "select", options: mentions?.map((m) => ({ value: m.id, label: m.name })) ?? [] },
    { key: "name", label: "Nom du parcours (filière)", placeholder: "ex : Développement web et mobile" },
    { key: "code", label: "Code", placeholder: "ex : P-DEV-WEB" },
    { key: "description", label: "Description (facultatif)", placeholder: "Brève description", required: false },
  ];

  return (
    <SectionCard icon={<GraduationCap size={18} className="text-rose-600" />} title="Parcours (filières)" count={parcours?.length ?? 0}
      tools={<>
        <select className={filterSelect} value={filterMentionId} onChange={(e) => setFilterMentionId(e.target.value)}>
          <option value="all">Toutes les mentions</option>
          {mentions?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <AddButton onClick={() => setOpen(true)} />
      </>}>
      {isLoading ? <Loading /> : filtered.length === 0 ? (
        <Empty>Aucun parcours. Ajoutez les filières de chaque mention (ex. : Développement web, Réseaux, Comptabilité…).</Empty>
      ) : (
        filtered.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-5 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-950/40">
              <GraduationCap size={15} className="text-rose-600 dark:text-rose-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.name}</p>
              <p className="truncate text-xs text-muted-foreground">{p.code} · {p.mention?.name}{p.description ? ` · ${p.description}` : ""}</p>
            </div>
            <RowActions onEdit={() => setEditing(p)} onDelete={() => confirmRemove(p.id, p.name)}
              deleting={remove.isPending && remove.variables === p.id} />
          </div>
        ))
      )}
      {open && (
        <FormDialog title="Nouveau parcours (filière)" fields={fields} loading={create.isPending} onClose={() => setOpen(false)}
          onSubmit={async (v) => {
            await create.mutateAsync({ name: v.name, code: v.code, mentionId: v.mentionId, description: v.description || undefined });
            toast.success(`Parcours « ${v.name} » créé`);
            setOpen(false);
          }} />
      )}
      {editing && (
        <FormDialog title="Modifier le parcours" submitLabel="Enregistrer" fields={fields} loading={update.isPending}
          initial={{ mentionId: editing.mentionId, name: editing.name, code: editing.code, description: editing.description ?? "" }}
          onClose={() => setEditing(null)}
          onSubmit={async (v) => {
            await update.mutateAsync({ id: editing.id, data: { mentionId: v.mentionId, name: v.name, code: v.code, description: v.description } });
            toast.success("Parcours enregistré");
            setEditing(null);
          }} />
      )}
    </SectionCard>
  );
}

// ─── Fil de la hiérarchie ─────────────────────────────────────────────────────

function HierarchyBreadcrumb() {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
      {["Université", "Faculté", "Département", "Mention", "Parcours (filière)"].map((item, i, arr) => (
        <span key={item} className="flex items-center gap-2">
          <span className={i === 0 ? "font-semibold text-foreground" : ""}>{item}</span>
          {i < arr.length - 1 && <ChevronRight size={12} />}
        </span>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function StructurePage() {
  const SECTIONS: { key: Kind; label: string }[] = [
    { key: "faculties",   label: "Facultés" },
    { key: "departments", label: "Départements" },
    { key: "mentions",    label: "Mentions" },
    { key: "parcours",    label: "Parcours (filières)" },
  ];
  const [activeSection, setActiveSection] = useState<Kind | "all">("all");
  const show = (k: Kind) => activeSection === "all" || activeSection === k;

  return (
    <div className="space-y-5">
      <HierarchyBreadcrumb />

      <div className="flex gap-2 overflow-x-auto">
        <button onClick={() => setActiveSection("all")}
          className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${activeSection === "all" ? "grad-classroom border-transparent text-white" : "hover:bg-accent"}`}>
          Tout afficher
        </button>
        {SECTIONS.map((s) => (
          <button key={s.key} onClick={() => setActiveSection(activeSection === s.key ? "all" : s.key)}
            className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${activeSection === s.key ? "grad-classroom border-transparent text-white" : "hover:bg-accent"}`}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {show("faculties") && <FacultiesSection />}
        {show("departments") && <DepartmentsSection />}
        {show("mentions") && <MentionsSection />}
        {show("parcours") && <ParcoursSection />}
      </div>
    </div>
  );
}
