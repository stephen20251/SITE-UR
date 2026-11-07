import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { useRequireClassroom } from "@/components/classroom/shared";
import {
  Plus, Calendar, Clock, CheckCircle2, BookOpen,
  ChevronRight, Loader2, Users, Send, AlertTriangle,
  CheckCircle, XCircle, FlaskConical, ChevronDown,
} from "lucide-react";

// Lundi de la semaine prochaine au format AAAA-MM-JJ
function nextMondayISO() {
  const d = new Date();
  d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const Route = createFileRoute("/classroom/planning/")({
  component: PlanningHub,
});

type AcYear   = { id: string; label?: string; name?: string };
type Mention  = { id: string; name: string; code: string };
type Semester = { id: string; name: string; number: number; academicYearId?: string };
type Period   = {
  id: string; name: string; status: string;
  availabilityDeadline: string | null; publishAt: string | null; publishedAt: string | null;
  createdAt: string;
  mention: { name: string; code: string };
  semester: { name: string; number: number };
  _count: { slots: number; availabilities: number };
};

const STATUS: Record<string, { label: string; dot: string; cls: string }> = {
  PREPARING: { label: "En préparation", dot: "bg-yellow-400", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  BUILDING:  { label: "En construction", dot: "bg-blue-400",  cls: "bg-blue-50 text-blue-700 border-blue-200" },
  VALIDATED: { label: "Validé",          dot: "bg-green-400", cls: "bg-green-50 text-green-700 border-green-200" },
  PUBLISHED: { label: "Publié",          dot: "bg-classroom", cls: "bg-classroom/5 text-classroom border-classroom/20" },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function PlanningHub() {
  const { user, ready } = useRequireClassroom(["SUPER_ADMIN", "STAFF"]);
  const isChef = !!(user?.systemRole === "SUPER_ADMIN" || user?.systemRole === "STAFF");

  const [periods,       setPeriods]       = useState<Period[]>([]);
  const [mentions,      setMentions]      = useState<Mention[]>([]);
  const [semesters,     setSemesters]     = useState<Semester[]>([]);
  const [academicYears, setAcademicYears] = useState<AcYear[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [creating,      setCreating]      = useState(false);
  const [form, setForm] = useState({
    name: "", mentionId: "", semesterId: "", yearId: "",
    availabilityDeadline: "", publishAt: "", weekStart: nextMondayISO(),
  });
  const [err,        setErr]        = useState("");
  const [diagResult, setDiagResult] = useState<{ label: string; ok: boolean }[] | null>(null);
  const [diaging,    setDiaging]    = useState(false);

  useEffect(() => {
    if (!ready) return;
    Promise.all([
      api<Period[]>("/schedule/periods").catch(() => []),
      api<Mention[]>("/structure/mentions").catch(() => []),
      api<Semester[]>("/structure/semesters").catch(() => []),
      api<AcYear[]>("/structure/academic-years").catch(() => []),
    ]).then(([p, m, s, y]) => {
      setPeriods(p as Period[]);
      setMentions(m as Mention[]);
      setSemesters(s as Semester[]);
      setAcademicYears(y as AcYear[]);
    }).finally(() => setLoading(false));
  }, [ready]);

  // Filter semesters by selected academic year
  const filteredSems = useMemo(() => {
    if (!form.yearId) return semesters;
    return semesters.filter((s) => s.academicYearId === form.yearId);
  }, [semesters, form.yearId]);

  async function runDiag() {
    setDiaging(true); setDiagResult(null);
    try {
      const [years, sems, mns, promos, grps] = await Promise.all([
        api<AcYear[]>("/structure/academic-years").catch(() => [] as AcYear[]),
        api<Semester[]>("/structure/semesters").catch(() => [] as Semester[]),
        api<Mention[]>("/structure/mentions").catch(() => [] as Mention[]),
        api<unknown[]>("/structure/promotions").catch(() => [] as unknown[]),
        api<unknown[]>("/structure/groups").catch(() => [] as unknown[]),
      ]);
      const results: { label: string; ok: boolean }[] = [
        { label: `Années universitaires (${(years as AcYear[]).length})`, ok: (years as AcYear[]).length > 0 },
        { label: `Semestres configurés (${(sems as Semester[]).length})`, ok: (sems as Semester[]).length > 0 },
        { label: `Mentions (${(mns as Mention[]).length})`, ok: (mns as Mention[]).length > 0 },
        { label: `Promotions (${(promos as unknown[]).length})`, ok: (promos as unknown[]).length > 0 },
        { label: `Groupes (${(grps as unknown[]).length})`, ok: (grps as unknown[]).length > 0 },
      ];
      if ((sems as Semester[]).length === 0) {
        results.push({ label: "Aucun semestre — créez des semestres dans Configuration → Structure", ok: false });
      } else if ((years as AcYear[]).length > 0) {
        const linkedCount = (sems as Semester[]).filter((s) => s.academicYearId).length;
        results.push({ label: `Semestres liés à une année (${linkedCount}/${(sems as Semester[]).length})`, ok: linkedCount > 0 });
      }
      setDiagResult(results);
    } finally { setDiaging(false); }
  }

  async function createPeriod() {
    if (!form.name || !form.mentionId || !form.semesterId) { setErr("Remplissez tous les champs requis"); return; }
    setCreating(true); setErr("");
    try {
      const p = await api<Period>("/schedule/periods", {
        method: "POST",
        body: { ...form, availabilityDeadline: form.availabilityDeadline || null, publishAt: form.publishAt || null, weekStart: form.weekStart || null },
      });
      setPeriods((prev) => [p, ...prev]);
      setShowForm(false);
      setForm({ name: "", mentionId: "", semesterId: "", yearId: "", availabilityDeadline: "", publishAt: "", weekStart: nextMondayISO() });
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erreur"); }
    finally { setCreating(false); }
  }

  if (!ready || !user) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Emplois du temps</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gérez les périodes de planification et suivez leur avancement.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runDiag} disabled={diaging}
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            {diaging ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />}
            Diagnostic
          </button>
          {isChef && (
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 rounded-xl grad-classroom px-4 py-2.5 text-sm font-semibold text-white shadow-elegant">
              <Plus size={16} /> Nouvelle période
            </button>
          )}
        </div>
      </div>

      {/* Diagnostic results */}
      {diagResult && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-2">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <FlaskConical size={15} className="text-classroom" /> Diagnostic de la configuration académique
          </h3>
          {diagResult.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {r.ok
                ? <CheckCircle size={14} className="text-green-500 shrink-0" />
                : <XCircle size={14} className="text-red-500 shrink-0" />}
              <span className={r.ok ? "text-gray-700" : "text-red-600"}>{r.label}</span>
            </div>
          ))}
          <button onClick={() => setDiagResult(null)} className="text-xs text-gray-400 hover:text-gray-600 mt-1">
            Fermer
          </button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="rounded-2xl border border-classroom/20 bg-card p-6 shadow-elegant space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Calendar size={18} className="text-classroom" /> Créer une période de planification
          </h2>
          {err && <p className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle size={14} /> {err}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nom <span className="text-red-500">*</span>
              </label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex : Emploi du temps S1 2026-2027"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-classroom focus:ring-2 focus:ring-classroom/10" />
            </div>

            {/* Année universitaire — determines available semesters */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Année universitaire</label>
              <div className="relative">
                <select value={form.yearId}
                  onChange={(e) => setForm({ ...form, yearId: e.target.value, semesterId: "" })}
                  className="w-full appearance-none rounded-xl border border-gray-200 px-4 py-2.5 pr-8 text-sm outline-none focus:border-classroom focus:ring-2 focus:ring-classroom/10">
                  <option value="">— Toutes les années —</option>
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>{y.label ?? y.name ?? y.id}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-gray-400" />
              </div>
            </div>

            {/* Semestre — cascades from year */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Semestre <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select value={form.semesterId}
                  onChange={(e) => setForm({ ...form, semesterId: e.target.value })}
                  disabled={filteredSems.length === 0}
                  className="w-full appearance-none rounded-xl border border-gray-200 px-4 py-2.5 pr-8 text-sm outline-none focus:border-classroom focus:ring-2 focus:ring-classroom/10 disabled:opacity-50 disabled:bg-gray-50">
                  <option value="">
                    {filteredSems.length === 0
                      ? "Aucun semestre disponible"
                      : "— Choisir un semestre —"}
                  </option>
                  {filteredSems.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-gray-400" />
              </div>
              {filteredSems.length === 0 && (
                <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle size={11} />
                  {semesters.length === 0
                    ? "Aucun semestre en base — créez-les dans Configuration → Structure"
                    : "Aucun semestre pour cette année — sélectionnez une autre année ou laissez vide"}
                </p>
              )}
            </div>

            {/* Mention */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Mention <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select value={form.mentionId} onChange={(e) => setForm({ ...form, mentionId: e.target.value })}
                  className="w-full appearance-none rounded-xl border border-gray-200 px-4 py-2.5 pr-8 text-sm outline-none focus:border-classroom focus:ring-2 focus:ring-classroom/10">
                  <option value="">— Choisir une mention —</option>
                  {mentions.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Semaine planifiée (lundi)</label>
              <input type="date" value={form.weekStart}
                onChange={(e) => setForm({ ...form, weekStart: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-classroom" />
              <p className="mt-1 text-xs text-gray-400">Les enseignants cochent leurs disponibilités pour cette semaine.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date limite (professeurs)</label>
              <input type="datetime-local" value={form.availabilityDeadline}
                onChange={(e) => setForm({ ...form, availabilityDeadline: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-classroom" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date de publication</label>
              <input type="datetime-local" value={form.publishAt}
                onChange={(e) => setForm({ ...form, publishAt: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-classroom" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowForm(false)}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button onClick={createPeriod} disabled={creating}
              className="flex items-center gap-2 rounded-xl grad-classroom px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Créer
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : periods.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-16 text-gray-400">
          <Calendar size={40} className="mb-3 opacity-30" />
          <p className="font-medium">Aucune période de planification</p>
          {isChef && <p className="text-sm mt-1">Créez une période pour commencer.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {periods.map((p) => {
            const s = STATUS[p.status] ?? STATUS.PREPARING;
            return (
              <Link key={p.id} to="/classroom/planning/$id" params={{ id: p.id }}
                className="flex items-center gap-5 rounded-2xl border border-gray-100 bg-card p-5 shadow-elegant hover:shadow-md transition-all group">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${s.cls}`}>
                  <div className={`h-3 w-3 rounded-full ${s.dot}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
                    <span className="text-xs text-gray-400">{p.mention.name} · {p.semester.name}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-classroom transition-colors">{p.name}</h3>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><BookOpen size={11} /> {p._count.slots} créneaux</span>
                    <span className="flex items-center gap-1"><Users size={11} /> {p._count.availabilities} dispo.</span>
                    {p.availabilityDeadline && (
                      <span className="flex items-center gap-1"><Clock size={11} /> Limite : {fmt(p.availabilityDeadline)}</span>
                    )}
                    {p.publishAt && (
                      <span className="flex items-center gap-1"><Send size={11} /> Pub. : {fmt(p.publishAt)}</span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="shrink-0 text-gray-300 group-hover:text-classroom transition-colors" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
