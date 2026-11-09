import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, FileText, CreditCard, ClipboardCheck, Calendar, TrendingUp,
  BookOpen, Award, Receipt, UserCheck, Briefcase, Bell, Mail, Search,
  ArrowLeft, Printer, X, Star, StarOff, RefreshCw, Download,
  GraduationCap, Shield, Users, CheckSquare, Square, ChevronDown,
  User, ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { api, tokenStore } from "@/lib/api";
import { useDocumentTemplates, CATEGORY_LABELS, CATEGORY_COLORS, type DocumentTemplate } from "@/lib/documents";
import { useSemesters } from "@/lib/classroom";
import { useRequireClassroom } from "@/components/classroom/shared";
import { API_ORIGIN } from "@/lib/env";

export const Route = createFileRoute("/classroom/documents")({ component: DocumentsPage });

// ── Icon map ───────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText, CreditCard, ClipboardCheck, Calendar, TrendingUp,
  BookOpen, Award, Receipt, UserCheck, Briefcase, Bell, Mail,
  GraduationCap, Shield,
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  ETUDIANT:       GraduationCap,
  ENSEIGNANT:     UserCheck,
  ADMINISTRATION: Shield,
};

// ── Types ──────────────────────────────────────────────────────────────────────

type AcademicYear = { id: string; name?: string; label?: string; isCurrent?: boolean };
type Mention      = { id: string; name: string; code?: string };
type Promotion    = { id: string; name: string; level: string; mentionId: string; academicYearId: string; _count?: { students: number } };
type Group        = { id: string; name: string; _count?: { students: number } };
type StudentRow   = {
  id: string; matricule: string | null;
  user: { id: string; firstName: string; lastName: string; avatarUrl?: string | null };
  promotion?: { id: string; name: string; level: string; mention?: { name: string }; academicYear?: { name: string } } | null;
  group?: { id: string; name: string } | null;
};
type TeacherRow   = {
  id: string; employeeId?: string | null; specialization?: string | null;
  user: { firstName: string; lastName: string; avatarUrl?: string | null };
  mention?: { name: string } | null;
};
type SemesterRow = { id: string; name: string; academicYear?: { name: string } | null };

type GenMode = "one" | "group" | "promotion" | "mention";

// ── Structure hooks ────────────────────────────────────────────────────────────

function useAcademicYears() {
  return useQuery({ queryKey: ["structure", "academic-years"], queryFn: () => api<AcademicYear[]>("/structure/academic-years") });
}
function useMentions() {
  return useQuery({ queryKey: ["structure", "mentions"], queryFn: () => api<Mention[]>("/structure/mentions") });
}
function usePromotions(params: { mentionId?: string; academicYearId?: string }) {
  const qs = new URLSearchParams();
  if (params.mentionId) qs.set("mentionId", params.mentionId);
  if (params.academicYearId) qs.set("academicYearId", params.academicYearId);
  return useQuery({
    queryKey: ["structure", "promotions", params],
    queryFn: () => api<Promotion[]>(`/structure/promotions?${qs}`),
    enabled: !!(params.mentionId || params.academicYearId),
  });
}
function useGroups(promotionId: string | undefined) {
  return useQuery({
    queryKey: ["structure", "groups", promotionId],
    queryFn: () => api<Group[]>(`/structure/promotions/${promotionId}/groups`),
    enabled: !!promotionId,
  });
}
function useDocStudents(params: { academicYearId?: string; mentionId?: string; promotionId?: string; groupId?: string }) {
  const qs = new URLSearchParams();
  if (params.academicYearId) qs.set("academicYearId", params.academicYearId);
  if (params.mentionId)      qs.set("mentionId", params.mentionId);
  if (params.promotionId)    qs.set("promotionId", params.promotionId);
  if (params.groupId)        qs.set("groupId", params.groupId);
  const enabled = !!(params.promotionId || params.groupId || params.mentionId);
  return useQuery({
    queryKey: ["documents", "students", params],
    queryFn: () => api<StudentRow[]>(`/documents/students?${qs}`),
    enabled,
  });
}

// ── Simple search picker for teachers ─────────────────────────────────────────

type PickerTeacher = { id: string; fullName: string; specialization?: string | null };

function TeacherPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [q, setQ]             = useState("");
  const [results, setResults] = useState<PickerTeacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [display, setDisplay] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!q || q.length < 2 || q === display) { setResults([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        // Renvoie l'id du profil enseignant attendu par la génération de documents
        const data = await api<PickerTeacher[]>(`/letters/teachers?q=${encodeURIComponent(q)}`);
        setResults(data ?? []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  }, [q]);

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Enseignant</label>
      <div className="relative">
        <input type="text" placeholder="Nom de l'enseignant…" value={q}
          onChange={(e) => { setQ(e.target.value); setDisplay(""); onChange(""); }}
          className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom" />
        {loading && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
        {results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border bg-card shadow-lg overflow-hidden">
            {results.map((t) => (
              <button key={t.id} onClick={() => { setDisplay(t.fullName); setQ(t.fullName); setResults([]); onChange(t.id); }}
                className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-accent transition-colors border-b last:border-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full grad-classroom text-xs font-bold text-white">
                  {t.fullName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">{t.fullName}</div>
                  <div className="text-xs text-muted-foreground">{t.specialization || "Enseignant"}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        {value && display && <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">✓ {display}</p>}
      </div>
    </div>
  );
}

// ── Select component ───────────────────────────────────────────────────────────

function Select({ label, value, onChange, options, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
          className="w-full appearance-none rounded-xl border bg-background px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-classroom disabled:opacity-50">
          <option value="">{placeholder ?? `— ${label} —`}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}

// ── Hierarchical student selector ──────────────────────────────────────────────

function StudentBeneficiarySelector({
  mode, systemRole,
  onSelectSingle,
  onSelectBulk,
}: {
  mode: GenMode;
  systemRole: string;
  onSelectSingle: (id: string) => void;
  onSelectBulk: (ids: string[]) => void;
}) {
  const [yearId,     setYearId]     = useState("");
  const [mentionId,  setMentionId]  = useState("");
  const [promotionId, setPromoId]   = useState("");
  const [groupId,    setGroupId]    = useState("");
  const [selected,   setSelected]   = useState<Set<string>>(new Set());

  const years      = useAcademicYears();
  const mentions   = useMentions();
  const promotions = usePromotions({ mentionId: mentionId || undefined, academicYearId: yearId || undefined });
  const groups     = useGroups(promotionId || undefined);

  // For bulk: fetch students based on current context
  const studentsQ = useDocStudents(
    mode === "group"     ? { promotionId, groupId }                         :
    mode === "promotion" ? { promotionId }                                  :
    mode === "mention"   ? { mentionId: mentionId || undefined, academicYearId: yearId || undefined } :
    { promotionId: "" } // "one" mode — no bulk query
  );

  const students = studentsQ.data ?? [];

  // Reset downstream when upstream changes
  function changeYear(id: string) { setYearId(id); setMentionId(""); setPromoId(""); setGroupId(""); setSelected(new Set()); }
  function changeMention(id: string) { setMentionId(id); setPromoId(""); setGroupId(""); setSelected(new Set()); }
  function changePromo(id: string)   { setPromoId(id);   setGroupId(""); setSelected(new Set()); }
  function changeGroup(id: string)   { setGroupId(id);   setSelected(new Set()); }

  // Selection helpers
  const allIds    = students.map((s) => s.id);
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someChecked = !allChecked && allIds.some((id) => selected.has(id));

  function toggleAll() {
    if (allChecked) { setSelected(new Set()); }
    else { setSelected(new Set(allIds)); }
  }
  function toggle(id: string) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  // Single mode: show a simple dropdown of students from the promotion/group
  if (mode === "one") {
    const [singleId, setSingleId] = useState("");
    return (
      <div className="space-y-3">
        <Select label="Année universitaire" value={yearId} onChange={changeYear}
          options={(years.data ?? []).map((y) => ({ value: y.id, label: y.label ?? y.name ?? y.id }))} />
        <Select label="Mention" value={mentionId} onChange={changeMention} disabled={!yearId}
          options={(mentions.data ?? []).map((m) => ({ value: m.id, label: m.name }))} />
        <Select label="Promotion / Niveau" value={promotionId} onChange={changePromo}
          disabled={!mentionId}
          options={(promotions.data ?? []).map((p) => ({ value: p.id, label: `${p.name} — ${p.level}` }))} />
        <Select label="Groupe (optionnel)" value={groupId} onChange={changeGroup}
          disabled={!promotionId}
          options={(groups.data ?? []).map((g) => ({ value: g.id, label: g.name }))} />

        {/* Student list for single pick */}
        {promotionId && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Étudiant</label>
            {studentsQ.isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-2"><Loader2 className="h-3 w-3 animate-spin" /> Chargement…</div>
            ) : (
              <select value={singleId} onChange={(e) => { setSingleId(e.target.value); onSelectSingle(e.target.value); }}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom">
                <option value="">— Sélectionner un étudiant —</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.user.lastName.toUpperCase()} {s.user.firstName}{s.matricule ? ` (${s.matricule})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    );
  }

  // Bulk mode: filters + checkbox list
  const needsPromo   = mode === "group" || mode === "promotion";
  const needsGroup   = mode === "group";
  const canQuery     = mode === "mention" ? !!mentionId : mode === "promotion" ? !!promotionId : (!!promotionId && !!groupId);

  return (
    <div className="space-y-3">
      <Select label="Année universitaire" value={yearId} onChange={changeYear}
        options={(years.data ?? []).map((y) => ({ value: y.id, label: y.label ?? y.name ?? y.id }))} />
      <Select label="Mention" value={mentionId} onChange={changeMention} disabled={!yearId}
        options={(mentions.data ?? []).map((m) => ({ value: m.id, label: m.name }))} />
      {needsPromo && (
        <Select label="Promotion / Niveau" value={promotionId} onChange={changePromo}
          disabled={!mentionId}
          options={(promotions.data ?? []).map((p) => ({ value: p.id, label: `${p.name} — ${p.level}` }))} />
      )}
      {needsGroup && (
        <Select label="Groupe" value={groupId} onChange={changeGroup}
          disabled={!promotionId}
          options={(groups.data ?? []).map((g) => ({ value: g.id, label: `${g.name}${g._count ? ` (${g._count.students})` : ""}` }))} />
      )}

      {/* Student list with checkboxes */}
      {canQuery && (
        <div className="rounded-xl border overflow-hidden">
          {/* Header row */}
          <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
            <button onClick={toggleAll} className="flex h-4 w-4 items-center justify-center text-classroom">
              {allChecked ? <CheckSquare size={16} /> : someChecked ? <CheckSquare size={16} className="opacity-50" /> : <Square size={16} />}
            </button>
            <span className="text-xs font-medium text-muted-foreground">
              {studentsQ.isLoading ? "Chargement…" : `${students.length} étudiant${students.length !== 1 ? "s" : ""} trouvé${students.length !== 1 ? "s" : ""}`}
            </span>
            {selected.size > 0 && (
              <span className="ml-auto text-xs font-semibold text-classroom">{selected.size} sélectionné{selected.size !== 1 ? "s" : ""}</span>
            )}
          </div>

          {studentsQ.isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : students.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">Aucun étudiant dans ce contexte.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto">
              {students.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-3 border-b last:border-0 px-3 py-2 hover:bg-accent transition-colors">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)}
                    className="h-4 w-4 rounded border-gray-300 accent-classroom" />
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full grad-classroom text-[10px] font-bold text-white">
                    {s.user.firstName[0]}{s.user.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.user.lastName.toUpperCase()} {s.user.firstName}</p>
                    <p className="text-[10px] text-muted-foreground">{s.matricule ?? "—"}{s.group ? ` · ${s.group.name}` : ""}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Bulk action */}
          {students.length > 0 && (
            <div className="border-t bg-muted/20 px-3 py-2 flex gap-2">
              <button onClick={() => onSelectBulk([...selected])}
                disabled={selected.size === 0}
                className="flex-1 rounded-lg bg-classroom py-2 text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity">
                {selected.size === 0 ? "Sélectionnez des étudiants" : `Générer ${selected.size} document${selected.size !== 1 ? "s" : ""}`}
              </button>
              <button onClick={() => onSelectBulk(allIds)}
                className="rounded-lg border px-3 py-2 text-xs font-medium hover:bg-accent transition-colors whitespace-nowrap">
                Tous ({students.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Generator panel ────────────────────────────────────────────────────────────

const STUDENT_INPUT_TYPES = ["student"];
const TEACHER_INPUT_TYPES = ["teacher"];

function GeneratorPanel({
  template, onClose, semesters, systemRole,
}: {
  template: DocumentTemplate;
  onClose: () => void;
  semesters: SemesterRow[];
  systemRole: string;
}) {
  const Icon     = ICON_MAP[template.icon] ?? FileText;
  const colorCls = CATEGORY_COLORS[template.category] ?? "bg-muted text-muted-foreground border-border";

  // Does this template target students?
  const targetsStudents = template.requiredInputs.some((i) => STUDENT_INPUT_TYPES.includes(i.type));
  const targetsTeacher  = template.requiredInputs.some((i) => TEACHER_INPUT_TYPES.includes(i.type));

  // Extra non-person inputs (semester, text, date…)
  const extraInputs = template.requiredInputs.filter((i) => !STUDENT_INPUT_TYPES.includes(i.type) && !TEACHER_INPUT_TYPES.includes(i.type));

  const [genMode,     setGenMode]     = useState<GenMode>("one");
  const [extraValues, setExtraValues] = useState<Record<string, string>>({});
  const [teacherId,   setTeacherId]   = useState("");
  const [html,        setHtml]        = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);

  function setExtra(key: string, val: string) { setExtraValues((p) => ({ ...p, [key]: val })); setHtml(null); }

  const isBulkMode = genMode !== "one";

  // Single student generate
  async function generateSingle(studentId: string) {
    if (!studentId) return;
    setLoading(true); setHtml(null);
    try {
      const inputs = { studentId, ...extraValues };
      const token  = tokenStore.access;
      const r = await fetch(
        `${API_ORIGIN}/api/documents/generate/${template.id}`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` }, body: JSON.stringify(inputs) },
      );
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as { message?: string }).message ?? "Erreur"); }
      setHtml(await r.text());
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }

  // Teacher generate
  async function generateTeacher() {
    if (!teacherId) return;
    setLoading(true); setHtml(null);
    try {
      const token = tokenStore.access;
      const r = await fetch(
        `${API_ORIGIN}/api/documents/generate/${template.id}`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` }, body: JSON.stringify({ teacherId, ...extraValues }) },
      );
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as { message?: string }).message ?? "Erreur"); }
      setHtml(await r.text());
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }

  // Bulk generate
  async function generateBulk(studentIds: string[]) {
    if (studentIds.length === 0) return;
    setLoading(true); setHtml(null);
    try {
      const token = tokenStore.access;
      const items = studentIds.map((studentId) => ({ studentId, ...extraValues }));
      const r = await fetch(
        `${API_ORIGIN}/api/documents/generate-bulk/${template.id}`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` }, body: JSON.stringify({ items }) },
      );
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as { message?: string }).message ?? "Erreur"); }
      const bulkHtml = await r.text();
      setHtml(bulkHtml);
      toast.success(`${studentIds.length} document${studentIds.length !== 1 ? "s" : ""} générés`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur de génération en masse"); }
    finally { setLoading(false); }
  }

  function print() {
    if (!html) return;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
  }
  function download() {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${template.id}-${Date.now()}.html`; a.click();
  }

  // Auto-select own profile if student
  useEffect(() => {
    if (targetsStudents && systemRole === "STUDENT") {
      api<{ profile?: { id?: string } }>("/me/context")
        .then((ctx) => { if (ctx.profile?.id) generateSingle(ctx.profile.id); })
        .catch(() => {});
    }
  }, [template.id, systemRole]);

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0">
      {/* ── Left: config panel ─────────────────────────────── */}
      <div className="flex w-full flex-col border-r border-gray-100 dark:border-gray-800 lg:w-88 lg:shrink-0" style={{ width: "22rem" }}>
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-4 py-4">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft size={18} /></button>
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${colorCls}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{template.name}</p>
            <p className="text-[10px] text-muted-foreground">{CATEGORY_LABELS[template.category]}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Mode selector — only for student templates, and only for non-student roles */}
          {targetsStudents && systemRole !== "STUDENT" && (
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">Mode de génération</label>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  ["one",       User,       "Un étudiant"],
                  ["group",     Users,      "Un groupe"],
                  ["promotion", ListChecks, "Une promotion"],
                  ["mention",   GraduationCap, "Une mention"],
                ] as [GenMode, React.ComponentType<{ size?: number; className?: string }>, string][]).map(([m, MIcon, label]) => (
                  <button key={m} onClick={() => { setGenMode(m); setHtml(null); }}
                    className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition-all ${
                      genMode === m ? "border-classroom bg-classroom/10 text-classroom" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}>
                    <MIcon size={13} /> {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Student selector */}
          {targetsStudents && systemRole !== "STUDENT" && (
            <StudentBeneficiarySelector
              mode={genMode}
              systemRole={systemRole}
              onSelectSingle={(id) => { if (id) generateSingle(id); }}
              onSelectBulk={generateBulk}
            />
          )}

          {/* Student (own profile) */}
          {targetsStudents && systemRole === "STUDENT" && (
            <div className="rounded-xl border bg-muted/30 px-3 py-3">
              <p className="text-xs text-muted-foreground">Document généré pour votre profil automatiquement.</p>
            </div>
          )}

          {/* Teacher selector */}
          {targetsTeacher && (
            <TeacherPicker value={teacherId} onChange={(id) => { setTeacherId(id); setHtml(null); }} />
          )}

          {/* Extra inputs (semester, text, date…) */}
          {extraInputs.map((inp) => {
            if (inp.type === "semester") {
              return (
                <Select key={inp.key} label={inp.label} value={extraValues[inp.key] ?? ""}
                  onChange={(v) => setExtra(inp.key, v)}
                  options={semesters
                    // Un étudiant n'obtient ses notes qu'une fois le semestre terminé
                    .filter((s) => systemRole !== "STUDENT" || ((s as { endDate?: string }).endDate && new Date((s as { endDate?: string }).endDate!) < new Date() && !(s as { isActive?: boolean }).isActive))
                    .map((s) => ({ value: s.id, label: `${s.name}${s.academicYear ? ` (${s.academicYear.name})` : ""}` }))} />
              );
            }
            return (
              <div key={inp.key}>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{inp.label}</label>
                {inp.type === "textarea" ? (
                  <textarea value={extraValues[inp.key] ?? ""} onChange={(e) => setExtra(inp.key, e.target.value)}
                    rows={4} className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom resize-none"
                    placeholder={`Saisissez ${inp.label.toLowerCase()}…`} />
                ) : (
                  <input type={inp.type === "date" ? "datetime-local" : "text"}
                    value={extraValues[inp.key] ?? ""} onChange={(e) => setExtra(inp.key, e.target.value)}
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom"
                    placeholder={`Saisissez ${inp.label.toLowerCase()}…`} />
                )}
              </div>
            );
          })}

          {/* Teacher generate button */}
          {targetsTeacher && teacherId && (
            <button onClick={generateTeacher} disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl grad-classroom px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw size={14} />} Générer l'aperçu
            </button>
          )}
        </div>

        {/* Print/download actions */}
        {html && (
          <div className="border-t p-4 space-y-2">
            <button onClick={print}
              className="flex w-full items-center justify-center gap-2 rounded-xl grad-classroom px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
              <Printer size={14} /> Imprimer / PDF
            </button>
            <button onClick={download}
              className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors">
              <Download size={14} /> Télécharger
            </button>
          </div>
        )}
      </div>

      {/* ── Right: preview ─────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-h-0 bg-gray-50 dark:bg-gray-950">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">Prévisualisation</span>
          {html && (
            <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Document prêt
            </div>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Génération en cours…</p>
            </div>
          ) : html ? (
            <iframe srcDoc={html} className="h-full w-full border-0" title="Aperçu" sandbox="allow-same-origin" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground/40 gap-2">
              <FileText size={56} />
              <p className="text-sm font-medium text-muted-foreground">L'aperçu apparaît ici</p>
              <p className="text-xs text-muted-foreground/60">
                {isBulkMode ? "Sélectionnez les étudiants et cliquez Générer" : "Sélectionnez un bénéficiaire"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Template card grid ─────────────────────────────────────────────────────────

function TemplateGrid({
  templates, favorites, onSelect, onToggleFav,
}: {
  templates: DocumentTemplate[];
  favorites: Set<string>;
  onSelect: (t: DocumentTemplate) => void;
  onToggleFav: (id: string, e: React.MouseEvent) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => {
        const Icon     = ICON_MAP[t.icon] ?? FileText;
        const colorCls = CATEGORY_COLORS[t.category] ?? "bg-muted text-muted-foreground border-border";
        const isFav    = favorites.has(t.id);
        return (
          <div key={t.id} onClick={() => onSelect(t)}
            role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onSelect(t)}
            className="group relative flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-elegant text-left transition-all hover:border-classroom hover:shadow-md focus:outline-none focus:ring-2 focus:ring-classroom/30 cursor-pointer">
            <div className="flex items-start justify-between gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${colorCls}`}>
                <Icon className="h-5 w-5" />
              </div>
              <button onClick={(e) => onToggleFav(t.id, e)}
                className="rounded-lg p-1 hover:bg-accent transition-colors"
                title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}>
                {isFav ? <Star size={14} className="fill-amber-400 text-amber-400" /> : <StarOff size={14} className="text-muted-foreground/50" />}
              </button>
            </div>
            <div>
              <h3 className="font-semibold text-foreground group-hover:text-classroom transition-colors">{t.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t.description}</p>
            </div>
            <div className="mt-auto pt-2 border-t flex items-center justify-between">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${colorCls}`}>
                {CATEGORY_LABELS[t.category]}
              </span>
              <span className="text-xs text-classroom font-medium opacity-0 group-hover:opacity-100 transition-opacity">Générer →</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

function DocumentsPage() {
  const { user, ready } = useRequireClassroom();
  const templates       = useDocumentTemplates();
  const semesters       = useSemesters({ enabled: ready && !!user });

  const [search,    setSearch]    = useState("");
  const [category,  setCategory]  = useState<string>("ALL");
  const [selected,  setSelected]  = useState<DocumentTemplate | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("doc_favorites") ?? "[]")); }
    catch { return new Set(); }
  });

  function toggleFavorite(id: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem("doc_favorites", JSON.stringify([...next]));
      return next;
    });
  }

  if (!ready || !user) {
    return <div className="grid min-h-96 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (selected) {
    return (
      <div className="-m-4 lg:-m-6 h-[calc(100vh-3.5rem)]">
        <GeneratorPanel
          template={selected}
          onClose={() => setSelected(null)}
          semesters={(semesters.data ?? []) as SemesterRow[]}
          systemRole={user.systemRole}
        />
      </div>
    );
  }

  const all      = templates.data ?? [];
  const favItems = all.filter((t) => favorites.has(t.id));
  const categories = ["ALL", ...new Set(all.map((t) => t.category))];

  const filtered = all.filter((t) => {
    const matchCat = category === "ALL" || t.category === category;
    const matchQ   = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchQ;
  });

  const grouped = (category === "ALL" ? [...new Set(filtered.map((t) => t.category))] : [category])
    .reduce<Record<string, DocumentTemplate[]>>((acc, cat) => {
      const items = filtered.filter((t) => t.category === cat);
      if (items.length) acc[cat] = items;
      return acc;
    }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Documents administratifs</h1>
        <p className="text-muted-foreground">Choisissez un modèle — les données sont remplies automatiquement.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Rechercher un modèle… (certificat, relevé, carte…)"
            value={search} onChange={(e) => { setSearch(e.target.value); setCategory("ALL"); }}
            className="w-full rounded-xl border bg-card pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-classroom shadow-elegant" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const CatIcon = c === "ALL" ? FileText : (CATEGORY_ICONS[c] ?? FileText);
            return (
              <button key={c} onClick={() => setCategory(c)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                  category === c ? "bg-classroom text-white border-classroom shadow-sm" : "bg-card text-muted-foreground hover:text-foreground"
                }`}>
                <CatIcon size={14} />
                {c === "ALL" ? "Tous" : CATEGORY_LABELS[c]}
              </button>
            );
          })}
        </div>
      </div>

      {templates.isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : all.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-16 text-center text-muted-foreground">
          <FileText className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="font-medium">Aucun modèle disponible</p>
        </div>
      ) : (
        <div className="space-y-8">
          {!search && favItems.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <Star size={13} className="fill-amber-400 text-amber-400" /> Favoris
              </h2>
              <TemplateGrid templates={favItems} favorites={favorites} onSelect={setSelected} onToggleFav={toggleFavorite} />
            </section>
          )}
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Aucun modèle ne correspond à "{search}".</p>
          ) : (
            Object.entries(grouped).map(([cat, items]) => {
              const CatIcon = CATEGORY_ICONS[cat] ?? FileText;
              return (
                <section key={cat}>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <CatIcon size={14} /> {CATEGORY_LABELS[cat]}
                    <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal normal-case">{items.length}</span>
                  </h2>
                  <TemplateGrid templates={items} favorites={favorites} onSelect={setSelected} onToggleFav={toggleFavorite} />
                </section>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
