import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, TrendingUp, ChevronDown, Save, CheckCircle2,
  BookOpen, Users, AlertTriangle, BarChart3, X, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { isMentionResponsible, useRequireClassroom } from "@/components/classroom/shared";
import { useAuth } from "@/lib/auth";
import { useMyGrades, useSemesters, type Grade } from "@/lib/classroom";

export const Route = createFileRoute("/classroom/notes")({ component: NotesPage });

// ── Grade type labels ──────────────────────────────────────────────────────────

const GRADE_TYPES = [
  { value: "CONTINUOUS", label: "CC",          long: "Contrôle Continu",  coeff: 0.4 },
  { value: "MIDTERM",    label: "DS",           long: "Devoir Surveillé",  coeff: 0.2 },
  { value: "FINAL",      label: "Examen",       long: "Examen Final",      coeff: 0.6 },
  { value: "PROJECT",    label: "TP/Projet",    long: "Travaux Pratiques", coeff: 0.3 },
  { value: "RATTRAPAGE", label: "Rattrapage",   long: "Examen de Rattrapage", coeff: 1.0 },
] as const;

type GradeTypeVal = typeof GRADE_TYPES[number]["value"];

const GRADE_TYPE_MAP = Object.fromEntries(GRADE_TYPES.map((t) => [t.value, t]));

// ── Types ──────────────────────────────────────────────────────────────────────

type AcYear    = { id: string; label?: string; name?: string; isCurrent?: boolean };
type Mention   = { id: string; name: string; code: string };
type Semester  = { id: string; name: string; number: number; academicYearId?: string };
type Promo     = { id: string; name: string; level: string; mentionId: string };
type Group     = { id: string; name: string };
type Subject   = { id: string; code: string; name: string; credits: number };
type StudentRow = {
  student: {
    id: string; matricule: string;
    user: { firstName: string; lastName: string };
  };
  gradeMap: Record<string, { id: string; value: number; maxValue: number; coefficient: number }>;
};
type AverageRow = {
  student: { id: string; matricule: string; user: { firstName: string; lastName: string } };
  subjects: { subject: Subject; avg: number | null }[];
  summary: { gpa: number | null; totalCredits: number; earnedCredits: number; passed: boolean };
};

// ── Hooks ──────────────────────────────────────────────────────────────────────

function useAcYears()  { return useQuery({ queryKey: ["structure","academic-years"], queryFn: () => api<AcYear[]>("/structure/academic-years") }); }
function useMentions() { return useQuery({ queryKey: ["structure","mentions"],       queryFn: () => api<Mention[]>("/structure/mentions") }); }
function useSems(yearId?: string) {
  return useQuery({
    queryKey: ["semesters", yearId],
    queryFn: () => yearId
      ? api<Semester[]>(`/structure/academic-years/${yearId}/semesters`)
      : api<Semester[]>("/structure/semesters"),
  });
}
function usePromos(menId?: string, yearId?: string) {
  const qs = new URLSearchParams();
  if (menId)  qs.set("mentionId",    menId);
  if (yearId) qs.set("academicYearId", yearId);
  return useQuery({
    queryKey: ["promos", menId, yearId],
    queryFn: () => api<Promo[]>(`/structure/promotions?${qs}`),
    enabled: !!(menId || yearId),
  });
}
function useGroups(proId?: string) {
  return useQuery({
    queryKey: ["groups", proId],
    queryFn: () => api<Group[]>(`/structure/promotions/${proId}/groups`),
    enabled: !!proId,
  });
}
function useSubjects(menId?: string) {
  return useQuery({
    queryKey: ["subjects", menId],
    queryFn: () => api<Subject[]>(`/structure/subjects?mentionId=${menId}`),
    enabled: !!menId,
  });
}
function useClassGrades(subjectId?: string, groupId?: string, promoId?: string, semId?: string, type?: string) {
  const qs = new URLSearchParams();
  if (subjectId) qs.set("subjectId", subjectId);
  if (groupId)   qs.set("groupId",   groupId);
  if (promoId)   qs.set("promotionId", promoId);
  if (semId)     qs.set("semesterId", semId);
  if (type)      qs.set("type", type);
  return useQuery({
    queryKey: ["classlist", subjectId, groupId, promoId, semId, type],
    queryFn: () => api<StudentRow[]>(`/grades/classlist?${qs}`),
    enabled: !!subjectId,
  });
}
function useAverages(promoId?: string, groupId?: string, semId?: string) {
  const qs = new URLSearchParams();
  if (promoId) qs.set("promotionId", promoId);
  if (groupId) qs.set("groupId",     groupId);
  if (semId)   qs.set("semesterId",  semId);
  return useQuery({
    queryKey: ["averages", promoId, groupId, semId],
    queryFn: () => api<AverageRow[]>(`/grades/averages?${qs}`),
    enabled: !!(semId && (promoId || groupId)),
  });
}

// ── Shared select ──────────────────────────────────────────────────────────────

function Sel({ label, value, onChange, options, disabled, placeholder }: {
  label?: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; disabled?: boolean; placeholder?: string;
}) {
  return (
    <div>
      {label && <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>}
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
          className="w-full appearance-none rounded-xl border bg-background px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-classroom disabled:opacity-50">
          <option value="">{placeholder ?? `— ${label ?? "Choisir"} —`}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}

// ── Grade color helpers ────────────────────────────────────────────────────────

function gradeColor(v: number, max: number = 20) {
  const pct = v / max;
  if (pct >= 0.85) return "text-emerald-600";
  if (pct >= 0.70) return "text-blue-600";
  if (pct >= 0.50) return "text-amber-600";
  return "text-red-600";
}

function gradeBar(v: number, max: number = 20) {
  const pct = v / max;
  if (pct >= 0.85) return "bg-emerald-500";
  if (pct >= 0.70) return "bg-blue-500";
  if (pct >= 0.50) return "bg-amber-500";
  return "bg-red-500";
}

// ── Nœud de promotion dépliable ───────────────────────────────────────────────

function PromotionNode({ promo, open, semesters, semId, grpId, subId, onToggle, onSem, onGroup, onSubject }: {
  promo: Promo; open: boolean; semesters: Semester[]; semId: string; grpId: string; subId: string;
  onToggle: () => void; onSem: (id: string) => void; onGroup: (id: string) => void; onSubject: (id: string) => void;
}) {
  const subjects = useSubjects(open ? promo.mentionId : undefined);
  const groups = useGroups(open ? promo.id : undefined);
  const chip = (on: boolean) => `rounded-lg border px-2.5 py-1 text-xs transition ${on ? "border-classroom bg-classroom text-white" : "hover:bg-accent"}`;
  return (
    <div>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30">
        <ChevronDown size={14} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
        <span className="font-semibold text-sm">{promo.name}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">{promo.level}</span>
      </button>
      {open && (
        <div className="space-y-3 bg-muted/20 px-4 pb-4 pl-10">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-20 text-xs text-muted-foreground">Semestre</span>
            {semesters.map((x) => <button key={x.id} onClick={() => onSem(x.id)} className={chip(semId === x.id)}>{x.name}</button>)}
          </div>
          {(groups.data ?? []).length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-20 text-xs text-muted-foreground">Groupe</span>
              <button onClick={() => onGroup("")} className={chip(!grpId)}>Toute la promotion</button>
              {(groups.data ?? []).map((g) => <button key={g.id} onClick={() => onGroup(g.id)} className={chip(grpId === g.id)}>{g.name}</button>)}
            </div>
          )}
          <div className="flex flex-wrap items-start gap-1.5">
            <span className="w-20 pt-1 text-xs text-muted-foreground">Matière</span>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {subjects.isLoading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
              {(subjects.data ?? []).map((x) => (
                <button key={x.id} onClick={() => onSubject(x.id)} className={chip(subId === x.id)}>{x.code} — {x.name}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin Grade Entry ──────────────────────────────────────────────────────────

function AdminGradeEntry() {
  const qc = useQueryClient();

  const [yearId,   setYearId]   = useState("");
  const [semId,    setSemId]    = useState("");
  const [menId,    setMenId]    = useState("");
  const [proId,    setProId]    = useState("");
  const [grpId,    setGrpId]    = useState("");
  const [subId,    setSubId]    = useState("");
  const [grType,   setGrType]   = useState<GradeTypeVal>("CONTINUOUS");
  const [maxVal,   setMaxVal]   = useState(20);
  const [coeff,    setCoeff]    = useState(1);
  const [entries,  setEntries]  = useState<Record<string, string>>({});
  const [tab,      setTab]      = useState<"saisie" | "recapitulatif">("saisie");

  const years    = useAcYears();
  // On suit toujours l'année universitaire en cours (pas de choix d'année)
  const currentYearId = (years.data ?? []).find((y) => y.isCurrent)?.id ?? years.data?.[0]?.id ?? "";
  useEffect(() => { if (currentYearId && yearId !== currentYearId) setYearId(currentYearId); }, [currentYearId, yearId]);
  const { roles } = useAuth();
  const scopeMentionId = isMentionResponsible(roles?.[0]?.roleName) ? roles?.[0]?.scope?.mentionId ?? null : null;
  const sems     = useSems(yearId || undefined);
  const mentions = useMentions();
  const promos   = usePromos(undefined, yearId || undefined);
  const groups   = useGroups(proId || undefined);
  const subjects = useSubjects(menId || undefined);

  const classGrades = useClassGrades(subId || undefined, grpId || undefined, proId || undefined, semId || undefined, grType);
  const averages    = useAverages(proId || undefined, grpId || undefined, semId || undefined);

  const students: StudentRow[] = classGrades.data ?? [];

  const save = useMutation<{ saved: number }, Error, void>({
    mutationFn: () => {
      const entriesToSave = students
        .filter((s) => entries[s.student.id] !== undefined && entries[s.student.id] !== "")
        .map((s) => ({
          studentId: s.student.id,
          subjectId: subId,
          semesterId: semId || null,
          type: grType,
          value: parseFloat(entries[s.student.id]),
          maxValue: maxVal,
          coefficient: coeff,
        }));
      if (!entriesToSave.length) throw new Error("Aucune note à enregistrer");
      return api("/grades/bulk", { method: "POST", body: { entries: entriesToSave } });
    },
    onSuccess: (data: { saved: number }) => {
      toast.success(`${data.saved} note${data.saved !== 1 ? "s" : ""} enregistrée${data.saved !== 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["classlist"] });
      qc.invalidateQueries({ queryKey: ["averages"] });
      setEntries({});
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Sync entries from existing grades when classGrades loads
  const syncFromExisting = useCallback(() => {
    const synced: Record<string, string> = {};
    for (const s of students) {
      const existing = s.gradeMap[grType];
      if (existing) synced[s.student.id] = String(existing.value);
    }
    setEntries(synced);
  }, [students, grType]);

  const dirty = Object.keys(entries).some((k) => entries[k] !== "");

  return (
    <div className="space-y-5">
      {/* Sélection en liste dépliable : promotion → groupe / semestre / matière */}
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><BookOpen size={15} className="text-classroom" /> Classes — {(years.data ?? []).find((y) => y.id === yearId)?.label ?? "année en cours"}</h2>
          {subId && (
            <span className="text-xs text-muted-foreground">
              {(promos.data ?? []).find((p) => p.id === proId)?.name} · {(sems.data ?? []).find((x) => x.id === semId)?.name ?? "—"} · {(subjects.data ?? []).find((x) => x.id === subId)?.name}
            </span>
          )}
        </div>
        <div className="divide-y">
          {(promos.data ?? []).filter((p) => !scopeMentionId || p.mentionId === scopeMentionId).length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Aucune promotion pour l'année en cours.</p>
          )}
          {(promos.data ?? []).filter((p) => !scopeMentionId || p.mentionId === scopeMentionId).map((p) => (
            <PromotionNode key={p.id} promo={p} open={proId === p.id}
              semesters={sems.data ?? []} semId={semId} grpId={grpId} subId={subId}
              onToggle={() => {
                if (proId === p.id) { setProId(""); setSubId(""); return; }
                setProId(p.id); setMenId(p.mentionId); setGrpId(""); setSubId(""); setEntries({});
                if (!semId && sems.data?.length) setSemId(sems.data[0].id);
              }}
              onSem={setSemId} onGroup={setGrpId}
              onSubject={(id) => { setSubId(id); setEntries({}); }} />
          ))}
        </div>
      </div>

      {/* Tabs */}
      {subId && (
        <div className="flex border-b">
          {(["saisie", "recapitulatif"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold transition-colors ${tab === t ? "border-b-2 border-classroom text-classroom" : "text-muted-foreground hover:text-foreground"}`}>
              {t === "saisie" ? "Saisie des notes" : "Récapitulatif"}
            </button>
          ))}
        </div>
      )}

      {/* Grade entry tab */}
      {tab === "saisie" && subId && (
        <>
          {/* Grade type + settings bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 p-1 rounded-xl bg-muted">
              {GRADE_TYPES.map((t) => (
                <button key={t.value} onClick={() => { setGrType(t.value); setEntries({}); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${grType === t.value ? "bg-classroom text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs text-muted-foreground">Note sur :</label>
              <select value={maxVal} onChange={(e) => setMaxVal(Number(e.target.value))}
                className="rounded-lg border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-classroom">
                <option value={20}>20</option>
                <option value={40}>40</option>
                <option value={100}>100</option>
              </select>
              <label className="text-xs text-muted-foreground">Coeff :</label>
              <input type="number" value={coeff} min={0.1} step={0.1} max={10}
                onChange={(e) => setCoeff(Number(e.target.value))}
                className="w-16 rounded-lg border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-classroom" />
              <button onClick={syncFromExisting} className="flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs hover:bg-accent">
                <RefreshCw size={11} /> Charger existants
              </button>
            </div>
          </div>

          {/* Grade table */}
          {classGrades.isLoading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 text-center text-muted-foreground/50">
              <Users size={36} className="mb-3 opacity-30" />
              <p className="font-medium text-muted-foreground">Aucun étudiant</p>
              <p className="text-xs mt-1">Sélectionnez une promotion ou un groupe</p>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden flex flex-col">
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                <span className="text-sm font-semibold">{students.length} étudiant{students.length !== 1 ? "s" : ""} — {GRADE_TYPE_MAP[grType]?.long}</span>
                {dirty && (
                  <button onClick={() => save.mutate()} disabled={save.isPending}
                    className="flex items-center gap-2 rounded-xl grad-classroom px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                    {save.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Enregistrer {Object.values(entries).filter((v) => v !== "").length} notes
                  </button>
                )}
              </div>
              <div className="overflow-y-auto overflow-x-auto" style={{ maxHeight: "calc(100vh - 28rem)" }}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b bg-muted/30 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide backdrop-blur-sm">
                      <th className="px-4 py-2.5">Étudiant</th>
                      <th className="px-4 py-2.5">Matricule</th>
                      <th className="px-4 py-2.5">Note existante</th>
                      <th className="px-4 py-2.5 w-36">Nouvelle note /{maxVal}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => {
                      const ex = s.gradeMap[grType];
                      const newVal = entries[s.student.id];
                      const parsedNew = newVal !== undefined && newVal !== "" ? parseFloat(newVal) : null;
                      return (
                        <tr key={s.student.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 font-medium">
                            {s.student.user.lastName.toUpperCase()} {s.student.user.firstName}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{s.student.matricule}</td>
                          <td className="px-4 py-2.5">
                            {ex ? (
                              <span className={`font-semibold ${gradeColor(ex.value, ex.maxValue)}`}>
                                {ex.value}/{ex.maxValue}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="relative">
                              <input
                                type="number" min={0} max={maxVal} step={0.25}
                                value={entries[s.student.id] ?? ""}
                                onChange={(e) => setEntries((p) => ({ ...p, [s.student.id]: e.target.value }))}
                                placeholder={ex ? String(ex.value) : "—"}
                                className={`w-full rounded-xl border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom ${
                                  parsedNew !== null && (parsedNew < 0 || parsedNew > maxVal) ? "border-red-400 bg-red-50" : ""
                                }`}
                              />
                              {parsedNew !== null && parsedNew >= 0 && parsedNew <= maxVal && (
                                <span className={`absolute right-2.5 top-1.5 text-xs font-semibold ${gradeColor(parsedNew, maxVal)}`}>
                                  {Math.round((parsedNew / maxVal) * 100)}%
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {students.length > 0 && (
                <div className="border-t bg-muted/20 px-4 py-3 flex justify-end">
                  <button onClick={() => save.mutate()} disabled={save.isPending || !dirty}
                    className="flex items-center gap-2 rounded-xl grad-classroom px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                    {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Enregistrer les notes
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Summary tab */}
      {tab === "recapitulatif" && subId && semId && (
        <div className="space-y-4">
          {averages.isLoading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !averages.data?.length ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 text-center text-muted-foreground/50">
              <BarChart3 size={36} className="mb-3 opacity-30" />
              <p className="font-medium text-muted-foreground">Aucune moyenne calculable</p>
              <p className="text-xs mt-1">Saisissez d'abord les notes</p>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden flex flex-col">
              <div className="border-b bg-muted/30 px-4 py-3">
                <span className="text-sm font-semibold">Récapitulatif des moyennes — {(averages.data ?? []).length} étudiants</span>
              </div>
              <div className="overflow-y-auto overflow-x-auto" style={{ maxHeight: "calc(100vh - 28rem)" }}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b bg-muted/30 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide backdrop-blur-sm">
                      <th className="px-4 py-2.5">Étudiant</th>
                      <th className="px-4 py-2.5">Moyenne Générale</th>
                      <th className="px-4 py-2.5">Crédits</th>
                      <th className="px-4 py-2.5">Résultat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(averages.data ?? [])
                      .sort((a, b) => (b.summary.gpa ?? 0) - (a.summary.gpa ?? 0))
                      .map((row, i) => (
                        <tr key={row.student.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5">
                            <span className="text-xs text-muted-foreground mr-2">{i + 1}.</span>
                            <span className="font-medium">{row.student.user.lastName.toUpperCase()} {row.student.user.firstName}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            {row.summary.gpa !== null ? (
                              <span className={`text-lg font-bold ${gradeColor(row.summary.gpa, 20)}`}>
                                {row.summary.gpa.toFixed(2)}
                                <span className="text-xs font-normal text-muted-foreground">/20</span>
                              </span>
                            ) : <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-sm">
                            {row.summary.earnedCredits}/{row.summary.totalCredits} crédits
                          </td>
                          <td className="px-4 py-2.5">
                            {row.summary.gpa === null ? (
                              <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold bg-gray-50 text-gray-600 border-gray-200">En attente</span>
                            ) : row.summary.passed ? (
                              <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">✓ Admis(e)</span>
                            ) : (
                              <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold bg-red-50 text-red-700 border-red-200">Ajourné(e)</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {!subId && proId && (
        <div className="flex items-center gap-2 rounded-xl border bg-amber-50 border-amber-200 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle size={14} className="shrink-0" /> Sélectionnez une matière pour accéder à la saisie des notes
        </div>
      )}
    </div>
  );
}

// ── Student grade view ─────────────────────────────────────────────────────────

function gradeColorPct(pct: number) {
  if (pct >= 85) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 70) return "text-blue-600 dark:text-blue-400";
  if (pct >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}
function gradeBarPct(pct: number) {
  if (pct >= 85) return "bg-emerald-500";
  if (pct >= 70) return "bg-blue-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function StudentGradeView({ user }: { user: { systemRole: string } }) {
  const grades    = useMyGrades({ enabled: true });
  const semesters = useSemesters({ enabled: true });
  const [semId, setSemId] = useState<string>("all");

  const allGrades: Grade[] = grades.data ?? [];
  const filtered = semId === "all" ? allGrades : allGrades.filter((g) => g.semesterId === semId);

  const bySubject = new Map<string, { subject: Grade["subject"]; grades: Grade[] }>();
  for (const g of filtered) {
    if (!bySubject.has(g.subjectId)) bySubject.set(g.subjectId, { subject: g.subject, grades: [] });
    bySubject.get(g.subjectId)!.grades.push(g);
  }

  const subjectStats = [...bySubject.values()].map(({ subject, grades: sg }) => {
    const weighted = sg.reduce((s, g) => s + g.value * g.coefficient, 0);
    const totalCoeff = sg.reduce((s, g) => s + g.coefficient, 0);
    const avg = totalCoeff > 0 ? weighted / totalCoeff : 0;
    const maxValue = sg[0]?.maxValue ?? 20;
    return { subject, grades: sg, avg, pct: Math.round((avg / maxValue) * 100), maxValue };
  });

  const overallPct = subjectStats.length
    ? Math.round(subjectStats.reduce((s, x) => s + x.pct, 0) / subjectStats.length)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mes notes</h1>
          <p className="text-sm text-muted-foreground">Résultats académiques par matière</p>
        </div>
        <div className="relative">
          <select value={semId} onChange={(e) => setSemId(e.target.value)}
            className="appearance-none rounded-xl border bg-card px-4 py-2.5 pr-8 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-classroom">
            <option value="all">Tous les semestres</option>
            {(semesters.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-muted-foreground" />
        </div>
      </div>

      {overallPct !== null && (
        <div className="flex items-center gap-6 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <svg className="absolute inset-0" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
              <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 36}`}
                strokeDashoffset={`${2 * Math.PI * 36 * (1 - overallPct / 100)}`}
                strokeLinecap="round" className={gradeColorPct(overallPct)}
                style={{ transformOrigin: "center", transform: "rotate(-90deg)" }} />
            </svg>
            <span className={`relative text-xl font-bold ${gradeColorPct(overallPct)}`}>{overallPct}%</span>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Moyenne générale</p>
            <p className="text-3xl font-bold">{subjectStats.length > 0 ? (subjectStats.reduce((s, x) => s + x.avg, 0) / subjectStats.length).toFixed(2) : "—"}<span className="text-lg font-normal text-muted-foreground">/20</span></p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm text-muted-foreground">{subjectStats.length} matière{subjectStats.length !== 1 ? "s" : ""}</p>
            <p className={`text-sm font-semibold mt-1 ${overallPct >= 50 ? "text-emerald-600" : "text-red-600"}`}>
              {overallPct >= 50 ? "✓ En voie de validation" : "À améliorer"}
            </p>
          </div>
        </div>
      )}

      {grades.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : subjectStats.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center text-muted-foreground/50">
          <TrendingUp size={40} className="mb-3 opacity-30" />
          <p className="font-medium text-muted-foreground">Aucune note disponible</p>
          <p className="text-xs mt-1">Les notes apparaîtront ici après saisie par vos enseignants</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subjectStats.map(({ subject, grades: sg, avg, pct, maxValue }) => (
            <div key={subject?.id ?? avg} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="font-semibold">{subject?.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{subject?.code}</p>
                </div>
                <span className={`text-2xl font-bold shrink-0 ${gradeColorPct(pct)}`}>
                  {avg.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/{maxValue}</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
                <div className={`h-full rounded-full transition-all ${gradeBarPct(pct)}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex flex-wrap gap-2">
                {sg.map((g) => {
                  const t = GRADE_TYPE_MAP[g.type];
                  return (
                    <div key={g.id} className="rounded-lg border bg-muted/30 px-3 py-1.5 text-xs">
                      <span className="text-muted-foreground">{t?.label ?? g.type}: </span>
                      <span className="font-semibold">{g.value}/{g.maxValue}</span>
                      {g.coefficient !== 1 && <span className="ml-1 text-muted-foreground/60">×{g.coefficient}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

function NotesPage() {
  const { user, ready } = useRequireClassroom([
    "SUPER_ADMIN", "TEACHER", "STAFF", "STUDENT",
  ]);

  if (!ready || !user) return null;

  if (user.systemRole === "STUDENT") return <StudentGradeView user={user} />;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notes & Évaluations</h1>
        <p className="text-sm text-muted-foreground">Saisie des notes par classe, matière et type d'évaluation</p>
      </div>
      <AdminGradeEntry />
    </div>
  );
}
