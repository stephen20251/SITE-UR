import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { BookOpen, School, ClipboardList, CheckCircle, Calendar, PlusCircle, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/erp/resp-peda")({
  component: RespPedaDashboard,
});

type Subject = { id: string; name: string; code: string; coefficient: number; volumeHours: number; semester: { name: string } | null };
type Promotion = { id: string; name: string; level: string; mention: { name: string }; _count: { students: number; groups: number } };

function RespPedaDashboard() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<Subject[]>("/structure/subjects"),
      api<Promotion[]>("/structure/promotions"),
    ]).then(([s, p]) => {
      setSubjects(s);
      setPromotions(p);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Responsable Pédagogique</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestion des matières, promotions et examens.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-[#0F1E3C] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1B3A6B] transition-colors">
          <PlusCircle size={16} /> Nouvelle matière
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Matières", value: subjects.length, icon: <BookOpen size={18} className="text-blue-600" />, bg: "bg-blue-50" },
          { label: "Promotions", value: promotions.length, icon: <School size={18} className="text-purple-600" />, bg: "bg-purple-50" },
          { label: "Étudiants total", value: promotions.reduce((s, p) => s + p._count.students, 0), icon: <ClipboardList size={18} className="text-green-600" />, bg: "bg-green-50" },
          { label: "Volume horaire", value: subjects.reduce((s, sub) => s + sub.volumeHours, 0), icon: <Calendar size={18} className="text-orange-500" />, bg: "bg-orange-50" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${s.bg}`}>{s.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Subjects */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Matières</h2>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{subjects.length}</span>
          </div>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-[#0F1E3C] border-t-transparent" />
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {subjects.map(s => (
                <div key={s.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">{s.code.slice(0, 3)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.code} · Coeff. {s.coefficient} · {s.volumeHours}h</p>
                  </div>
                  {s.semester && (
                    <span className="shrink-0 text-xs text-gray-400">{s.semester.name}</span>
                  )}
                </div>
              ))}
              {subjects.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <BookOpen size={32} className="mb-2 opacity-40" />
                  <p className="text-sm">Aucune matière définie</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Promotions */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Promotions</h2>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{promotions.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {promotions.map(p => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-50">
                  <School size={16} className="text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.mention.name} · Niveau {p.level}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{p._count.students}</p>
                  <p className="text-xs text-gray-400">étudiants</p>
                </div>
              </div>
            ))}
            {promotions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <School size={32} className="mb-2 opacity-40" />
                <p className="text-sm">Aucune promotion</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Exam actions */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0F1E3C] to-[#1B3A6B] p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">Gestion des examens</h3>
            <p className="text-white/60 text-sm mt-1">Planifiez les sessions, validez les notes finales.</p>
          </div>
          <div className="flex gap-3">
            <button className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors border border-white/20">
              <ClipboardList size={15} /> Grilles de notes
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl bg-[#FFD166] px-4 py-2 text-sm font-bold text-[#0F1E3C] hover:bg-yellow-300 transition-colors">
              <BarChart3 size={15} /> Valider les notes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
