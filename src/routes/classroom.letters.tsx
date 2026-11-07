import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, FileText, ClipboardCheck, Award, Bell, AlertTriangle, Star,
  Mail, UserCheck, Briefcase, Shield, Search, ArrowLeft, Printer, Download,
  RefreshCw, X, GraduationCap, Users, History, ChevronDown, User, ListChecks,
  FileCheck, Navigation, CheckSquare, Square,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useRequireClassroom } from "@/components/classroom/shared";
import { useSemesters } from "@/lib/classroom";
import {
  useLetterTemplates, useLetterHistory, previewLetter, generateLetter,
  LETTER_CATEGORY_LABELS, LETTER_CATEGORY_COLORS,
  type LetterTemplate, type GeneratedDoc,
} from "@/lib/letters";

export const Route = createFileRoute("/classroom/letters")({ component: LettersPage });

// ── Icon map ───────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText, ClipboardCheck, Award, Bell, AlertTriangle, Star,
  Mail, UserCheck, Briefcase, Shield, FileCheck, Navigation, RefreshCw,
};

const CAT_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  ETUDIANT:  GraduationCap,
  ENSEIGNANT: UserCheck,
  PERSONNEL: Shield,
};

// ── Types ──────────────────────────────────────────────────────────────────────

type SemRow  = { id: string; name: string; academicYear?: { name: string } | null };
type AcYear  = { id: string; label?: string; name?: string };
type Mention = { id: string; name: string };
type Promo   = { id: string; name: string; level: string };
type Group   = { id: string; name: string; _count?: { students: number } };
type Student = {
  id: string; matricule: string | null;
  user: { firstName: string; lastName: string };
  promotion?: { name: string; level: string } | null;
  group?: { name: string } | null;
};
type Teacher = {
  id: string; employeeId?: string | null; specialization?: string | null;
  user: { firstName: string; lastName: string };
};
type StaffPerson = {
  id: string; employeeId?: string | null;
  fullName: string; email: string; department: string; office: string;
};

// ── Shared hooks ───────────────────────────────────────────────────────────────

function useAcYears() { return useQuery({ queryKey: ["structure","academic-years"], queryFn: () => api<AcYear[]>("/structure/academic-years") }); }
function useMentions() { return useQuery({ queryKey: ["structure","mentions"], queryFn: () => api<Mention[]>("/structure/mentions") }); }
function usePromos(p: { mentionId?: string; academicYearId?: string }) {
  const qs = new URLSearchParams();
  if (p.mentionId) qs.set("mentionId", p.mentionId);
  if (p.academicYearId) qs.set("academicYearId", p.academicYearId);
  return useQuery({ queryKey: ["structure","promotions",p], queryFn: () => api<Promo[]>(`/structure/promotions?${qs}`), enabled: !!(p.mentionId || p.academicYearId) });
}
function useGroups(promId?: string) {
  return useQuery({ queryKey: ["structure","groups",promId], queryFn: () => api<Group[]>(`/structure/promotions/${promId}/groups`), enabled: !!promId });
}
function useDocStudents(p: { academicYearId?: string; mentionId?: string; promotionId?: string; groupId?: string }) {
  const qs = new URLSearchParams();
  if (p.academicYearId) qs.set("academicYearId", p.academicYearId);
  if (p.mentionId) qs.set("mentionId", p.mentionId);
  if (p.promotionId) qs.set("promotionId", p.promotionId);
  if (p.groupId) qs.set("groupId", p.groupId);
  const enabled = !!(p.promotionId || p.mentionId);
  return useQuery({ queryKey: ["docs","students",p], queryFn: () => api<Student[]>(`/documents/students?${qs}`), enabled });
}

// ── Select widget ──────────────────────────────────────────────────────────────

function Sel({ label, value, onChange, options, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
          className="w-full appearance-none rounded-xl border bg-background px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-classroom disabled:opacity-50">
          <option value="">{placeholder ?? `— ${label} —`}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}

// ── Teacher picker ─────────────────────────────────────────────────────────────

type TeacherResult = { id: string; fullName: string; specialization: string; employeeId?: string | null };

function TeacherPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [q, setQ]       = useState("");
  const [res, setRes]   = useState<TeacherResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setBusy(true);
      try { setRes(await api<TeacherResult[]>(`/letters/teachers?q=${encodeURIComponent(q)}`)); }
      catch { setRes([]); } finally { setBusy(false); }
    }, 300);
  }, [q]);

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">Enseignant</label>
      <div className="relative">
        <input type="text" placeholder="Rechercher un enseignant…" value={q}
          onChange={(e) => { setQ(e.target.value); setLabel(""); onChange(""); }}
          className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom" />
        {busy && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
        {res.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border bg-card shadow-lg overflow-hidden">
            {res.map((t) => (
              <button key={t.id} onClick={() => { setLabel(t.fullName); setQ(t.fullName); setRes([]); onChange(t.id); }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-accent border-b last:border-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full grad-classroom text-[10px] font-bold text-white">
                  {t.fullName.slice(0, 2)}
                </div>
                <div>
                  <div className="font-medium">{t.fullName}</div>
                  <div className="text-xs text-muted-foreground">{t.specialization}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        {value && label && <p className="mt-1 text-xs text-emerald-600">✓ {label}</p>}
      </div>
    </div>
  );
}

// ── Staff picker ───────────────────────────────────────────────────────────────

function StaffPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [q, setQ]       = useState("");
  const [res, setRes]   = useState<StaffPerson[]>([]);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setBusy(true);
      try { setRes(await api<StaffPerson[]>(`/letters/staff?q=${encodeURIComponent(q)}`)); }
      catch { setRes([]); } finally { setBusy(false); }
    }, 300);
  }, [q]);

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">Agent du personnel</label>
      <div className="relative">
        <input type="text" placeholder="Rechercher un agent…" value={q}
          onChange={(e) => { setQ(e.target.value); setLabel(""); onChange(""); }}
          className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom" />
        {busy && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
        {res.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border bg-card shadow-lg overflow-hidden">
            {res.map((s) => (
              <button key={s.id} onClick={() => { setLabel(s.fullName); setQ(s.fullName); setRes([]); onChange(s.id); }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-accent border-b last:border-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white">
                  {s.fullName.slice(0, 2)}
                </div>
                <div>
                  <div className="font-medium">{s.fullName}</div>
                  <div className="text-xs text-muted-foreground">{s.department}{s.office && s.office !== "—" ? ` · ${s.office}` : ""}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        {value && label && <p className="mt-1 text-xs text-emerald-600">✓ {label}</p>}
      </div>
    </div>
  );
}

// ── Hierarchical student selector ──────────────────────────────────────────────

type GenMode = "one" | "group" | "promotion" | "mention";

function StudentSelector({
  mode, systemRole, onSingle, onBulk,
}: {
  mode: GenMode; systemRole: string;
  onSingle: (id: string) => void;
  onBulk: (ids: string[]) => void;
}) {
  const [yearId, setYear]   = useState("");
  const [menId,  setMen]    = useState("");
  const [proId,  setPro]    = useState("");
  const [grpId,  setGrp]    = useState("");
  const [sel,    setSel]    = useState<Set<string>>(new Set());
  const [single, setSingle] = useState("");

  const years  = useAcYears();
  const ments  = useMentions();
  const promos = usePromos({ mentionId: menId || undefined, academicYearId: yearId || undefined });
  const groups = useGroups(proId || undefined);
  const studQ  = useDocStudents(
    mode === "group"     ? { promotionId: proId, groupId: grpId } :
    mode === "promotion" ? { promotionId: proId } :
    mode === "mention"   ? { mentionId: menId, academicYearId: yearId } :
    /* "one" mode */       { promotionId: proId || undefined, groupId: grpId || undefined }
  );

  const students = studQ.data ?? [];
  const allIds   = students.map((s) => s.id);
  const allChk   = allIds.length > 0 && allIds.every((id) => sel.has(id));
  const someChk  = !allChk && allIds.some((id) => sel.has(id));

  function reset() { setSel(new Set()); setSingle(""); }
  function ch(setter: (v: string) => void) { return (v: string) => { setter(v); reset(); }; }

  if (mode === "one") {
    return (
      <div className="space-y-3">
        <Sel label="Année" value={yearId} onChange={(v) => { setYear(v); setMen(""); setPro(""); setGrp(""); }}
          options={(years.data ?? []).map((y) => ({ value: y.id, label: y.label ?? y.name ?? y.id }))} />
        <Sel label="Mention" value={menId} onChange={(v) => { setMen(v); setPro(""); setGrp(""); }} disabled={!yearId}
          options={(ments.data ?? []).map((m) => ({ value: m.id, label: m.name }))} />
        <Sel label="Promotion" value={proId} onChange={(v) => { setPro(v); setGrp(""); }} disabled={!menId}
          options={(promos.data ?? []).map((p) => ({ value: p.id, label: `${p.name} — ${p.level}` }))} />
        <Sel label="Groupe (opt.)" value={grpId} onChange={setGrp} disabled={!proId}
          options={(groups.data ?? []).map((g) => ({ value: g.id, label: g.name }))} />
        {proId && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Étudiant</label>
            {studQ.isLoading
              ? <div className="flex items-center gap-2 text-xs text-muted-foreground p-2"><Loader2 className="h-3 w-3 animate-spin" />Chargement…</div>
              : <select value={single} onChange={(e) => { setSingle(e.target.value); onSingle(e.target.value); }}
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom">
                  <option value="">— Sélectionner —</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.user.lastName.toUpperCase()} {s.user.firstName}{s.matricule ? ` (${s.matricule})` : ""}</option>
                  ))}
                </select>
            }
          </div>
        )}
      </div>
    );
  }

  const canQ = mode === "mention" ? !!menId : mode === "promotion" ? !!proId : (!!proId && !!grpId);
  return (
    <div className="space-y-3">
      <Sel label="Année" value={yearId} onChange={(v) => { setYear(v); setMen(""); setPro(""); setGrp(""); reset(); }}
        options={(years.data ?? []).map((y) => ({ value: y.id, label: y.label ?? y.name ?? y.id }))} />
      <Sel label="Mention" value={menId} onChange={ch(setMen)} disabled={!yearId}
        options={(ments.data ?? []).map((m) => ({ value: m.id, label: m.name }))} />
      {(mode === "group" || mode === "promotion") && (
        <Sel label="Promotion" value={proId} onChange={ch(setPro)} disabled={!menId}
          options={(promos.data ?? []).map((p) => ({ value: p.id, label: `${p.name} — ${p.level}` }))} />
      )}
      {mode === "group" && (
        <Sel label="Groupe" value={grpId} onChange={ch(setGrp)} disabled={!proId}
          options={(groups.data ?? []).map((g) => ({ value: g.id, label: `${g.name}${g._count ? ` (${g._count.students})` : ""}` }))} />
      )}
      {canQ && (
        <div className="rounded-xl border overflow-hidden">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
            <button onClick={() => setSel(allChk ? new Set() : new Set(allIds))} className="text-classroom">
              {allChk ? <CheckSquare size={15} /> : someChk ? <CheckSquare size={15} className="opacity-50" /> : <Square size={15} />}
            </button>
            <span className="text-xs text-muted-foreground">
              {studQ.isLoading ? "Chargement…" : `${students.length} étudiant${students.length !== 1 ? "s" : ""}`}
            </span>
            {sel.size > 0 && <span className="ml-auto text-xs font-semibold text-classroom">{sel.size} sélectionné{sel.size !== 1 ? "s" : ""}</span>}
          </div>
          {studQ.isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : students.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">Aucun étudiant.</p>
          ) : (
            <div className="max-h-52 overflow-y-auto">
              {students.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-3 border-b last:border-0 px-3 py-2 hover:bg-accent">
                  <input type="checkbox" checked={sel.has(s.id)}
                    onChange={() => setSel((p) => { const n = new Set(p); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}
                    className="h-4 w-4 rounded accent-classroom" />
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
          {students.length > 0 && (
            <div className="border-t bg-muted/20 flex gap-2 px-3 py-2">
              <button onClick={() => onBulk([...sel])} disabled={sel.size === 0}
                className="flex-1 rounded-lg bg-classroom py-2 text-xs font-semibold text-white disabled:opacity-40">
                {sel.size === 0 ? "Sélectionnez des étudiants" : `Générer ${sel.size} lettre${sel.size !== 1 ? "s" : ""}`}
              </button>
              <button onClick={() => onBulk(allIds)}
                className="rounded-lg border px-3 py-2 text-xs font-medium hover:bg-accent whitespace-nowrap">
                Tous ({students.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Letter generator panel ─────────────────────────────────────────────────────

function LetterPanel({
  template, onClose, semesters, systemRole,
}: {
  template: LetterTemplate; onClose: () => void;
  semesters: SemRow[]; systemRole: string;
}) {
  const Icon     = ICON_MAP[template.icon] ?? FileText;
  const colorCls = LETTER_CATEGORY_COLORS[template.category] ?? "bg-muted text-muted-foreground border-border";

  const hasStudent = template.requiredInputs.some((i) => i.type === "student");
  const hasTeacher = template.requiredInputs.some((i) => i.type === "teacher");
  const hasStaff   = template.requiredInputs.some((i) => i.type === "staff");
  const extras     = template.requiredInputs.filter((i) => !["student","teacher","staff"].includes(i.type));

  const [mode,    setMode]    = useState<GenMode>("one");
  const [extra,   setExtra]   = useState<Record<string, string>>({});
  const [teacher, setTeacher] = useState("");
  const [staff,   setStaff]   = useState("");
  const [html,    setHtml]    = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isBulk = mode !== "one";

  async function gen(inputs: Record<string, string>) {
    setLoading(true); setHtml(null);
    try {
      const h = await generateLetter(template.id, { ...inputs, ...extra });
      setHtml(h);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }

  async function genBulk(ids: string[]) {
    if (!ids.length) return;
    setLoading(true); setHtml(null);
    try {
      const pages = await Promise.all(ids.map((id) => generateLetter(template.id, { studentId: id, ...extra })));
      // Merge pages with page-break
      const bodies = pages.map((h, i) => {
        const m = h.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        return `<div style="${i < pages.length - 1 ? "page-break-after:always;" : ""}">${m ? m[1] : h}</div>`;
      }).join("\n");
      const head = pages[0].match(/<head[^>]*>[\s\S]*<\/head>/i)?.[0] ?? "<head></head>";
      setHtml(`<!DOCTYPE html><html lang="fr">${head}<body>${bodies}</body></html>`);
      toast.success(`${ids.length} lettre${ids.length !== 1 ? "s" : ""} générées`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }

  // Auto-fill own profile if student
  useEffect(() => {
    if (hasStudent && systemRole === "STUDENT") {
      api<{ profile?: { id?: string } }>("/me/context")
        .then((ctx) => { if (ctx.profile?.id) gen({ studentId: ctx.profile.id }); })
        .catch(() => {});
    }
  }, [template.id, systemRole]);

  function print() {
    if (!html) return;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
  }
  function download() {
    if (!html) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    a.download = `${template.id}-${Date.now()}.html`; a.click();
  }

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0">
      {/* Left: config */}
      <div className="flex flex-col border-r border-gray-100 dark:border-gray-800 shrink-0" style={{ width: "22rem" }}>
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-4 py-4">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={18} /></button>
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${colorCls}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{template.name}</p>
            <p className="text-[10px] text-muted-foreground">{LETTER_CATEGORY_LABELS[template.category]}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Mode selector — only for admin/staff targeting students */}
          {hasStudent && systemRole !== "STUDENT" && (
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">Mode</label>
              <div className="grid grid-cols-2 gap-1.5">
                {([ ["one", User, "Un étudiant"],
                    ["group", Users, "Un groupe"],
                    ["promotion", ListChecks, "Une promotion"],
                    ["mention", GraduationCap, "Une mention"],
                ] as Array<[GenMode, React.ComponentType<{ size?: number }>, string]>).map(([m, I, lbl]) => (
                  <button key={m} onClick={() => { setMode(m); setHtml(null); }}
                    className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition-all ${mode === m ? "border-classroom bg-classroom/10 text-classroom" : "text-muted-foreground hover:bg-accent"}`}>
                    <I size={13} /> {lbl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Student selector */}
          {hasStudent && systemRole !== "STUDENT" && (
            <StudentSelector mode={mode} systemRole={systemRole}
              onSingle={(id) => { if (id) gen({ studentId: id }); }}
              onBulk={genBulk} />
          )}
          {hasStudent && systemRole === "STUDENT" && (
            <div className="rounded-xl border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
              Document généré pour votre profil automatiquement.
            </div>
          )}

          {/* Teacher selector */}
          {hasTeacher && (
            <TeacherPicker value={teacher} onChange={(id) => { setTeacher(id); setHtml(null); }} />
          )}

          {/* Staff selector */}
          {hasStaff && (
            <StaffPicker value={staff} onChange={(id) => { setStaff(id); setHtml(null); }} />
          )}

          {/* Extra inputs */}
          {extras.map((inp) => {
            if (inp.type === "semester") {
              return (
                <Sel key={inp.key} label={inp.label} value={extra[inp.key] ?? ""}
                  onChange={(v) => { setExtra((p) => ({ ...p, [inp.key]: v })); setHtml(null); }}
                  options={semesters.map((s) => ({ value: s.id, label: `${s.name}${s.academicYear ? ` (${s.academicYear.name})` : ""}` }))} />
              );
            }
            return (
              <div key={inp.key}>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{inp.label}</label>
                {inp.type === "textarea" ? (
                  <textarea value={extra[inp.key] ?? ""} rows={4} onChange={(e) => { setExtra((p) => ({ ...p, [inp.key]: e.target.value })); setHtml(null); }}
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom resize-none"
                    placeholder={`Saisissez ${inp.label.toLowerCase()}…`} />
                ) : (
                  <input type={inp.type} value={extra[inp.key] ?? ""} onChange={(e) => { setExtra((p) => ({ ...p, [inp.key]: e.target.value })); setHtml(null); }}
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom"
                    placeholder={`Saisissez ${inp.label.toLowerCase()}…`} />
                )}
              </div>
            );
          })}

          {/* Teacher generate button */}
          {hasTeacher && teacher && (
            <button onClick={() => gen({ teacherId: teacher })} disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl grad-classroom px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw size={14} />} Générer l'aperçu
            </button>
          )}

          {/* Staff generate button */}
          {hasStaff && staff && (
            <button onClick={() => gen({ staffId: staff })} disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl grad-classroom px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw size={14} />} Générer l'aperçu
            </button>
          )}
        </div>

        {html && (
          <div className="border-t p-4 space-y-2">
            <button onClick={print}
              className="flex w-full items-center justify-center gap-2 rounded-xl grad-classroom px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
              <Printer size={14} /> Imprimer / PDF
            </button>
            <button onClick={download}
              className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-accent">
              <Download size={14} /> Télécharger HTML
            </button>
          </div>
        )}
      </div>

      {/* Right: preview */}
      <div className="flex flex-1 flex-col min-h-0 bg-gray-50 dark:bg-gray-950">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">Prévisualisation</span>
          {html && <div className="flex items-center gap-1 text-xs text-emerald-600"><div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Document prêt</div>}
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
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/40">
              <FileText size={56} />
              <p className="text-sm font-medium text-muted-foreground">Aperçu de la lettre</p>
              <p className="text-xs text-muted-foreground/60">
                {isBulk ? "Sélectionnez les destinataires et cliquez Générer" : "Complétez le formulaire à gauche"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── History tab ────────────────────────────────────────────────────────────────

function HistoryTab() {
  const { data, isLoading } = useLetterHistory(1);
  const [viewId, setViewId] = useState<string | null>(null);
  const [viewHtml, setViewHtml] = useState<string | null>(null);

  async function openDoc(id: string) {
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}/api/letters/history/${id}?html=1`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("us.accessToken") ?? ""}` },
      });
      setViewHtml(await r.text());
      setViewId(id);
    } catch { toast.error("Impossible de charger le document"); }
  }

  if (viewHtml) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <button onClick={() => { setViewId(null); setViewHtml(null); }} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={18} /></button>
          <span className="text-sm font-semibold">Aperçu du document archivé</span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { const w = window.open("","_blank"); if(w){w.document.write(viewHtml);w.document.close();setTimeout(()=>w.print(),400);}}}
              className="flex items-center gap-1.5 rounded-xl grad-classroom px-3 py-1.5 text-xs font-semibold text-white">
              <Printer size={13} /> Imprimer
            </button>
          </div>
        </div>
        <iframe srcDoc={viewHtml} className="flex-1 border-0" title="Aperçu archivé" sandbox="allow-same-origin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-base font-semibold">Mes documents générés</h2>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !data?.items.length ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          <History className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="font-medium">Aucun document généré</p>
          <p className="text-sm">Vos lettres et documents apparaîtront ici après génération.</p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden flex flex-col">
          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 20rem)" }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/40 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
              <tr>
                <th className="px-4 py-3 text-left">N°</th>
                <th className="px-4 py-3 text-left">Modèle</th>
                <th className="px-4 py-3 text-left">Destinataire</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((doc) => (
                <tr key={doc.id} className="border-t hover:bg-accent/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{doc.number}</td>
                  <td className="px-4 py-3 font-medium">{doc.templateName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{doc.recipientName}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(doc.generatedAt).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${doc.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      {doc.status === "ACTIVE" ? "Actif" : doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openDoc(doc.id)}
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">
                      Voir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

function LettersPage() {
  const { user, ready } = useRequireClassroom();
  const templates = useLetterTemplates();
  const semesters = useSemesters({ enabled: ready && !!user });

  const [tab,      setTab]      = useState<"library" | "history">("library");
  const [search,   setSearch]   = useState("");
  const [category, setCategory] = useState("ALL");
  const [selected, setSelected] = useState<LetterTemplate | null>(null);

  if (!ready || !user) {
    return <div className="grid min-h-96 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (selected) {
    return (
      <div className="-m-4 lg:-m-6 h-[calc(100vh-3.5rem)]">
        <LetterPanel template={selected} onClose={() => setSelected(null)}
          semesters={(semesters.data ?? []) as SemRow[]} systemRole={user.systemRole} />
      </div>
    );
  }

  const all      = templates.data ?? [];
  const cats     = ["ALL", ...new Set(all.map((t) => t.category))];
  const filtered = all.filter((t) => {
    const matchCat = category === "ALL" || t.category === category;
    const matchQ   = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchQ;
  });
  const grouped = (category === "ALL" ? [...new Set(filtered.map((t) => t.category))] : [category])
    .reduce<Record<string, LetterTemplate[]>>((acc, cat) => {
      const items = filtered.filter((t) => t.category === cat);
      if (items.length) acc[cat] = items;
      return acc;
    }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Lettres administratives</h1>
          <p className="text-muted-foreground">Modèles professionnels — données remplies automatiquement depuis l'ERP.</p>
        </div>
        <div className="flex gap-2">
          {(["library", "history"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition-all ${tab === t ? "bg-classroom text-white border-classroom" : "bg-card text-muted-foreground hover:text-foreground"}`}>
              {t === "library" ? <><FileText size={14} /> Bibliothèque</> : <><History size={14} /> Historique</>}
            </button>
          ))}
        </div>
      </div>

      {tab === "history" ? <HistoryTab /> : (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Rechercher une lettre…"
                value={search} onChange={(e) => { setSearch(e.target.value); setCategory("ALL"); }}
                className="w-full rounded-xl border bg-card pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-classroom shadow-elegant" />
              {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={14} /></button>}
            </div>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => {
                const CI = c === "ALL" ? FileText : (CAT_ICONS[c] ?? FileText);
                return (
                  <button key={c} onClick={() => setCategory(c)}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${category === c ? "bg-classroom text-white border-classroom" : "bg-card text-muted-foreground hover:text-foreground"}`}>
                    <CI size={14} /> {c === "ALL" ? "Tous" : LETTER_CATEGORY_LABELS[c]}
                  </button>
                );
              })}
            </div>
          </div>

          {templates.isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-8">
              {filtered.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Aucun modèle trouvé.</p>}
              {Object.entries(grouped).map(([cat, items]) => {
                const CI = CAT_ICONS[cat] ?? FileText;
                return (
                  <section key={cat}>
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      <CI size={14} /> {LETTER_CATEGORY_LABELS[cat]}
                      <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal normal-case">{items.length}</span>
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((t) => {
                        const Icon = ICON_MAP[t.icon] ?? FileText;
                        const cc   = LETTER_CATEGORY_COLORS[t.category] ?? "";
                        return (
                          <button key={t.id} onClick={() => setSelected(t)}
                            className="group flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-elegant text-left hover:border-classroom hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-classroom/30">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${cc}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-semibold group-hover:text-classroom transition-colors">{t.name}</h3>
                              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t.description}</p>
                            </div>
                            <div className="mt-auto pt-2 border-t flex items-center justify-between">
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cc}`}>{LETTER_CATEGORY_LABELS[t.category]}</span>
                              {t.signatoryRoles.length > 0 && (
                                <span className="text-[10px] text-muted-foreground">Signé : {t.signatoryRoles[0]}</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
