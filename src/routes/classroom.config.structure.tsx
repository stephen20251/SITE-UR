import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Loader2, ChevronRight, Building2, BookOpen, GraduationCap, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  useFaculties, useDepartments, useMentions, useParcours,
  useCreateFaculty, useCreateDepartment, useCreateMention, useCreateParcours,
  type Faculty, type Department, type Mention, type Parcours,
} from "@/lib/academic";
import { useAcademicYears } from "@/lib/academic";

export const Route = createFileRoute("/classroom/config/structure")({ component: StructurePage });

// ─── Shared form helpers ──────────────────────────────────────────────────────

const inp = "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-classroom/30 transition";

function AddDialog({ title, fields, onSubmit, onClose, loading }: {
  title: string;
  fields: { key: string; label: string; placeholder?: string; type?: "text" | "number" | "select"; options?: { value: string; label: string }[]; required?: boolean }[];
  onSubmit: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
  loading: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.options?.[0]?.value ?? ""]))
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(values);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="animate-in zoom-in-95 duration-200 w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1.5 block text-sm font-medium">
                {f.label}{f.required !== false && <span className="ml-0.5 text-red-500">*</span>}
              </label>
              {f.type === "select" ? (
                <select
                  className={inp}
                  value={values[f.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  required={f.required !== false}
                >
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input
                  type={f.type ?? "text"}
                  className={inp}
                  placeholder={f.placeholder}
                  value={values[f.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  required={f.required !== false}
                />
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold hover:bg-accent">Annuler</button>
            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

type ActiveSection = "faculties" | "departments" | "mentions" | "parcours";

function FacultiesSection({ campusId }: { campusId: string }) {
  const { data: faculties, isLoading } = useFaculties();
  const create = useCreateFaculty();
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border bg-card shadow-elegant overflow-hidden">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-classroom" />
          <h3 className="font-semibold">Facultés</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{faculties?.length ?? 0}</span>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl grad-classroom px-3 py-1.5 text-xs font-semibold text-white">
          <Plus size={13} /> Ajouter
        </button>
      </div>
      <div className="divide-y">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (faculties?.length ?? 0) === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Aucune faculté — créez la première.</div>
        ) : (
          faculties!.map((f) => (
            <div key={f.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-classroom/10">
                <Building2 size={15} className="text-classroom" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{f.name}</p>
                <p className="text-xs text-muted-foreground">{f.code}{f.deanName ? ` · ${f.deanName}` : ""}</p>
              </div>
              <div className={`h-2 w-2 rounded-full ${f.isActive ? "bg-emerald-500" : "bg-gray-300"}`} />
            </div>
          ))
        )}
      </div>
      {open && (
        <AddDialog
          title="Nouvelle faculté"
          fields={[
            { key: "name", label: "Nom de la faculté", placeholder: "ex: Faculté des Sciences" },
            { key: "code", label: "Code", placeholder: "ex: FAC-SC" },
            { key: "deanName", label: "Nom du doyen (optionnel)", placeholder: "ex: Prof. Rakoto", required: false },
          ]}
          loading={create.isPending}
          onClose={() => setOpen(false)}
          onSubmit={async (v) => {
            await create.mutateAsync({ name: v.name, code: v.code, campusId, deanName: v.deanName || undefined });
            toast.success(`Faculté "${v.name}" créée`);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function DepartmentsSection() {
  const { data: faculties } = useFaculties();
  const { data: departments, isLoading } = useDepartments();
  const create = useCreateDepartment();
  const [open, setOpen] = useState(false);
  const [filterFacId, setFilterFacId] = useState<string>("all");

  const filtered = departments?.filter((d) => filterFacId === "all" || d.facultyId === filterFacId) ?? [];

  return (
    <div className="rounded-2xl border bg-card shadow-elegant overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-indigo-600" />
          <h3 className="font-semibold">Départements</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{departments?.length ?? 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <select className="h-8 rounded-lg border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-classroom/30"
            value={filterFacId} onChange={(e) => setFilterFacId(e.target.value)}>
            <option value="all">Toutes les facultés</option>
            {faculties?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl grad-classroom px-3 py-1.5 text-xs font-semibold text-white">
            <Plus size={13} /> Ajouter
          </button>
        </div>
      </div>
      <div className="divide-y">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Aucun département.</div>
        ) : (
          filtered.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/40">
                <Building2 size={15} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{d.name}</p>
                <p className="text-xs text-muted-foreground">{d.code} · {d.faculty?.name}</p>
              </div>
              <div className={`h-2 w-2 rounded-full ${d.isActive ? "bg-emerald-500" : "bg-gray-300"}`} />
            </div>
          ))
        )}
      </div>
      {open && (
        <AddDialog
          title="Nouveau département"
          fields={[
            { key: "facultyId", label: "Faculté", type: "select", options: faculties?.map((f) => ({ value: f.id, label: f.name })) ?? [] },
            { key: "name", label: "Nom du département", placeholder: "ex: Département Informatique" },
            { key: "code", label: "Code", placeholder: "ex: DEPT-INFO" },
            { key: "headName", label: "Chef de département (optionnel)", placeholder: "ex: Dr. Randrianasolo", required: false },
          ]}
          loading={create.isPending}
          onClose={() => setOpen(false)}
          onSubmit={async (v) => {
            await create.mutateAsync({ name: v.name, code: v.code, facultyId: v.facultyId, headName: v.headName || undefined });
            toast.success(`Département "${v.name}" créé`);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function MentionsSection() {
  const { data: departments } = useDepartments();
  const { data: mentions, isLoading } = useMentions();
  const create = useCreateMention();
  const [open, setOpen] = useState(false);
  const [filterDeptId, setFilterDeptId] = useState<string>("all");

  const filtered = mentions?.filter((m) => filterDeptId === "all" || m.departmentId === filterDeptId) ?? [];

  const LEVELS = ["Licence", "Master", "Doctorat"];

  return (
    <div className="rounded-2xl border bg-card shadow-elegant overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-violet-600" />
          <h3 className="font-semibold">Mentions</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{mentions?.length ?? 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <select className="h-8 rounded-lg border bg-background px-2 text-xs outline-none"
            value={filterDeptId} onChange={(e) => setFilterDeptId(e.target.value)}>
            <option value="all">Tous les départements</option>
            {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl grad-classroom px-3 py-1.5 text-xs font-semibold text-white">
            <Plus size={13} /> Ajouter
          </button>
        </div>
      </div>
      <div className="divide-y">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Aucune mention.</div>
        ) : (
          filtered.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/40">
                <BookOpen size={15} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.code} · {m.level} · {m.duration} an{m.duration > 1 ? "s" : ""}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{m.department?.name}</span>
            </div>
          ))
        )}
      </div>
      {open && (
        <AddDialog
          title="Nouvelle mention"
          fields={[
            { key: "departmentId", label: "Département", type: "select", options: departments?.map((d) => ({ value: d.id, label: d.name })) ?? [] },
            { key: "name", label: "Nom de la mention", placeholder: "ex: Informatique" },
            { key: "code", label: "Code", placeholder: "ex: M-INFO" },
            { key: "level", label: "Niveau", type: "select", options: LEVELS.map((l) => ({ value: l, label: l })) },
            { key: "duration", label: "Durée (années)", type: "number", placeholder: "3" },
          ]}
          loading={create.isPending}
          onClose={() => setOpen(false)}
          onSubmit={async (v) => {
            await create.mutateAsync({
              name: v.name, code: v.code, departmentId: v.departmentId,
              level: v.level, duration: parseInt(v.duration) || 3,
            });
            toast.success(`Mention "${v.name}" créée`);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ParcoursSection() {
  const { data: mentions } = useMentions();
  const { data: parcours, isLoading } = useParcours();
  const create = useCreateParcours();
  const [open, setOpen] = useState(false);
  const [filterMentionId, setFilterMentionId] = useState<string>("all");

  const filtered = parcours?.filter((p) => filterMentionId === "all" || p.mentionId === filterMentionId) ?? [];

  return (
    <div className="rounded-2xl border bg-card shadow-elegant overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <GraduationCap size={18} className="text-rose-600" />
          <h3 className="font-semibold">Parcours</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{parcours?.length ?? 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <select className="h-8 rounded-lg border bg-background px-2 text-xs outline-none"
            value={filterMentionId} onChange={(e) => setFilterMentionId(e.target.value)}>
            <option value="all">Toutes les mentions</option>
            {mentions?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl grad-classroom px-3 py-1.5 text-xs font-semibold text-white">
            <Plus size={13} /> Ajouter
          </button>
        </div>
      </div>
      <div className="divide-y">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Aucun parcours.</div>
        ) : (
          filtered.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-950/40">
                <GraduationCap size={15} className="text-rose-600 dark:text-rose-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.code} · {p.mention?.name}</p>
              </div>
            </div>
          ))
        )}
      </div>
      {open && (
        <AddDialog
          title="Nouveau parcours"
          fields={[
            { key: "mentionId", label: "Mention", type: "select", options: mentions?.map((m) => ({ value: m.id, label: m.name })) ?? [] },
            { key: "name", label: "Nom du parcours", placeholder: "ex: Développement Web & Mobile" },
            { key: "code", label: "Code", placeholder: "ex: P-DEV-WEB" },
            { key: "description", label: "Description (optionnel)", placeholder: "Brève description", required: false },
          ]}
          loading={create.isPending}
          onClose={() => setOpen(false)}
          onSubmit={async (v) => {
            await create.mutateAsync({ name: v.name, code: v.code, mentionId: v.mentionId, description: v.description || undefined });
            toast.success(`Parcours "${v.name}" créé`);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Hierarchy breadcrumb ─────────────────────────────────────────────────────

function HierarchyBreadcrumb() {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
      {["Université", "Faculté", "Département", "Mention", "Parcours"].map((item, i, arr) => (
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
  const { data: years } = useAcademicYears();
  const campusId = years?.[0]?.campusId ?? "";

  const SECTIONS: { key: ActiveSection; label: string }[] = [
    { key: "faculties",   label: "Facultés" },
    { key: "departments", label: "Départements" },
    { key: "mentions",    label: "Mentions" },
    { key: "parcours",    label: "Parcours" },
  ];
  const [activeSection, setActiveSection] = useState<ActiveSection | "all">("all");

  return (
    <div className="space-y-5">
      <HierarchyBreadcrumb />

      {!campusId && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400">
          <AlertCircle size={15} className="shrink-0" />
          Chargement du campus en cours…
        </div>
      )}

      {/* Section filter */}
      <div className="flex gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveSection("all")}
          className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${activeSection === "all" ? "grad-classroom text-white border-transparent" : "hover:bg-accent"}`}
        >
          Tout afficher
        </button>
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(activeSection === s.key ? "all" : s.key)}
            className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${activeSection === s.key ? "grad-classroom text-white border-transparent" : "hover:bg-accent"}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {(activeSection === "all" || activeSection === "faculties")   && <FacultiesSection campusId={campusId} />}
        {(activeSection === "all" || activeSection === "departments")  && <DepartmentsSection />}
        {(activeSection === "all" || activeSection === "mentions")     && <MentionsSection />}
        {(activeSection === "all" || activeSection === "parcours")     && <ParcoursSection />}
      </div>
    </div>
  );
}
