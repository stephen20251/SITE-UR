import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { api } from "../lib/api";
import { useErpAuth } from "./erp";
import {
  Plus, Calendar, Clock, CheckCircle2, BookOpen,
  ChevronRight, Loader2, Users, Send, AlertTriangle, CheckCircle, XCircle, FlaskConical,
} from "lucide-react";

export const Route = createFileRoute("/erp/planning/")({
  component: PlanningHub,
});

type AcYear  = { id: string; label?: string; name?: string };
type Mention  = { id: string; name: string; code: string };
type Semester = { id: string; name: string; number: number; academicYearId?: string };
type Period = {
  id: string; name: string; status: string;
  availabilityDeadline: string | null; publishAt: string | null; publishedAt: string | null;
  createdAt: string;
  mention: { name: string; code: string };
  semester: { name: string; number: number };
  _count: { slots: number; availabilities: number };
};

const STATUS: Record<string, { label: string; dot: string; cls: string }> = {
  PREPARING:  { label: "En préparation", dot: "bg-yellow-400", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  BUILDING:   { label: "En construction", dot: "bg-blue-400",  cls: "bg-blue-50 text-blue-700 border-blue-200" },
  VALIDATED:  { label: "Validé",          dot: "bg-green-400", cls: "bg-green-50 text-green-700 border-green-200" },
  PUBLISHED:  { label: "Publié",          dot: "bg-[#0F1E3C]", cls: "bg-[#0F1E3C]/5 text-[#0F1E3C] border-[#0F1E3C]/20" },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function PlanningHub() {
  const { user, roles } = useErpAuth();
  const isChef = user?.systemRole === "SUPER_ADMIN" || user?.systemRole === "STAFF" ||
    roles.some((r) => r.roleName?.includes("Chef"));

  const [periods, setPeriods] = useState<Period[]>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [academicYears, setAcademicYears] = useState<AcYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", mentionId: "", semesterId: "", yearId: "", availabilityDeadline: "", publishAt: "" });
  const [err, setErr] = useState("");
  const [diagResult, setDiagResult] = useState<{ label: string; ok: boolean }[] | null>(null);
  const [diaging, setDiaging] = useState(false);

  useEffect(() => {
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
  }, []);

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
      const results: { label: string; ok: boolean }[] = [];
      results.push({ label: `Années universitaires (${(years as AcYear[]).length})`, ok: (years as AcYear[]).length > 0 });
      results.push({ label: `Semestres configurés (${(sems as Semester[]).length})`, ok: (sems as Semester[]).length > 0 });
      results.push({ label: `Mentions (${(mns as Mention[]).length})`, ok: (mns as Mention[]).length > 0 });
      results.push({ label: `Promotions (${(promos as unknown[]).length})`, ok: (promos as unknown[]).length > 0 });
      results.push({ label: `Groupes (${(grps as unknown[]).length})`, ok: (grps as unknown[]).length > 0 });
      if ((sems as Semester[]).length === 0) results.push({ label: "⚠ Aucun semestre lié aux années — créez des semestres dans Configuration", ok: false });
      setDiagResult(results);
    } finally { setDiaging(false); }
  }

  async function createPeriod() {
    if (!form.name || !form.mentionId || !form.semesterId) { setErr("Remplissez tous les champs requis"); return; }
    setCreating(true); setErr("");
    try {
      const p = await api<Period>("/schedule/periods", {
        method: "POST",
        body: { ...form, availabilityDeadline: form.availabilityDeadline || null, publishAt: form.publishAt || null },
      });
      setPeriods((prev) => [p, ...prev]);
      setShowForm(false);
      setForm({ name: "", mentionId: "", semesterId: "", yearId: "", availabilityDeadline: "", publishAt: "" });
    } catch (e: any) { setErr(e.message); }
    finally { setCreating(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Emplois du temps</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gérez les périodes de planification et suivez leur avancement.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runDiag} disabled={diaging}
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            {diaging ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />} Diagnostic
          </button>
          {isChef && (
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 rounded-xl bg-[#0F1E3C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1B3A6B] transition-colors">
              <Plus size={16} /> Nouvelle période
            </button>
          )}
        </div>
      </div>

      {/* Create form */}
      {/* Diagnostic results */}
      {diagResult && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-2">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><FlaskConical size={15} className="text-[#0F1E3C]" /> Diagnostic académique</h3>
          {diagResult.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {r.ok ? <CheckCircle size={14} className="text-green-500 shrink-0" /> : <XCircle size={14} className="text-red-500 shrink-0" />}
              <span className={r.ok ? "text-gray-700" : "text-red-600"}>{r.label}</span>
            </div>
          ))}
          <button onClick={() => setDiagResult(null)} className="text-xs text-gray-400 hover:text-gray-600 mt-1">Fermer</button>
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl border border-[#0F1E3C]/20 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Calendar size={18} className="text-[#0F1E3C]" /> Créer une période de planification
          </h2>
          {err && <p className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle size={14} /> {err}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex : Emploi du temps S1 2026"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#0F1E3C] focus:ring-2 focus:ring-[#0F1E3C]/10" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Année universitaire</label>
              <select value={form.yearId} onChange={(e) => setForm({ ...form, yearId: e.target.value, semesterId: "" })}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#0F1E3C]">
                <option value="">— Toutes les années —</option>
                {academicYears.map((y) => <option key={y.id} value={y.id}>{y.label ?? y.name ?? y.id}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Semestre <span className="text-red-500">*</span></label>
              <select value={form.semesterId} onChange={(e) => setForm({ ...form, semesterId: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#0F1E3C]"
                disabled={filteredSems.length === 0}>
                <option value="">
                  {filteredSems.length === 0
                    ? "Aucun semestre disponible — créez des semestres dans Configuration"
                    : "— Choisir un semestre —"}
                </option>
                {filteredSems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {filteredSems.length === 0 && (
                <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle size={11} /> Configurez d'abord les semestres dans <b>Configuration → Structure</b>
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mention <span className="text-red-500">*</span></label>
              <select value={form.mentionId} onChange={(e) => setForm({ ...form, mentionId: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#0F1E3C]">
                <option value="">— Choisir —</option>
                {mentions.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date limite (professeurs)</label>
              <input type="datetime-local" value={form.availabilityDeadline} onChange={(e) => setForm({ ...form, availabilityDeadline: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#0F1E3C]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date de publication</label>
              <input type="datetime-local" value={form.publishAt} onChange={(e) => setForm({ ...form, publishAt: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#0F1E3C]" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowForm(false)}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button onClick={createPeriod} disabled={creating}
              className="flex items-center gap-2 rounded-xl bg-[#0F1E3C] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1B3A6B] transition-colors disabled:opacity-60">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Créer
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0F1E3C] border-t-[#FFD166]" />
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
              <Link key={p.id} to="/erp/planning/$id" params={{ id: p.id }}
                className="flex items-center gap-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-all group">
                {/* Status dot */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${s.cls}`}>
                  <div className={`h-3 w-3 rounded-full ${s.dot}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
                    <span className="text-xs text-gray-400">{p.mention.name} · {p.semester.name}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-[#0F1E3C] transition-colors">{p.name}</h3>
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

                <ChevronRight size={16} className="shrink-0 text-gray-300 group-hover:text-[#0F1E3C] transition-colors" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
