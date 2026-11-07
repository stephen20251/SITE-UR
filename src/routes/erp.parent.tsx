import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { GraduationCap, TrendingUp, CreditCard, CheckCircle, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/erp/parent")({
  component: ParentDashboard,
});

type Child = {
  id: string; matricule: string; level: string;
  user: { firstName: string; lastName: string; email: string };
  promotion: { name: string; mention: { name: string } } | null;
};
type Bulletin = {
  average: number | null; gpa: number | null;
  earnedCredits: number; totalCredits: number;
  subjects: { name: string; code: string; grade: number | null; isPassed: boolean | null; coefficient: number }[];
};

function ParentDashboard() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selected, setSelected] = useState<Child | null>(null);
  const [bulletin, setBulletin] = useState<Bulletin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Child[]>("/grades/my-children").then(c => {
      setChildren(c);
      if (c[0]) setSelected(c[0]);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    api<Bulletin>(`/grades/bulletin/${selected.id}`).then(setBulletin).catch(() => setBulletin(null));
  }, [selected]);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0F1E3C] border-t-[#FFD166]" />
    </div>
  );

  if (children.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-gray-400">
      <GraduationCap size={48} className="mb-4 opacity-40" />
      <p className="text-lg font-semibold text-gray-600">Aucun enfant associé</p>
      <p className="text-sm mt-2 text-center max-w-xs">Votre compte parent n'est pas encore lié à un étudiant. Contactez le secrétariat.</p>
    </div>
  );

  const passedSubjects = bulletin?.subjects.filter(s => s.isPassed).length ?? 0;
  const failedSubjects = bulletin?.subjects.filter(s => s.isPassed === false).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Suivi de mon enfant</h1>
        <p className="text-sm text-gray-500 mt-0.5">Consultez le parcours académique et les paiements.</p>
      </div>

      {/* Child selector */}
      {children.length > 1 && (
        <div className="flex gap-3 flex-wrap">
          {children.map(c => (
            <button key={c.id} onClick={() => setSelected(c)}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${selected?.id === c.id ? "border-[#0F1E3C] bg-[#0F1E3C] text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${selected?.id === c.id ? "bg-[#FFD166] text-[#0F1E3C]" : "bg-gray-100 text-gray-700"}`}>
                {c.user.firstName[0]}{c.user.lastName[0]}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">{c.user.firstName} {c.user.lastName}</p>
                <p className={`text-xs ${selected?.id === c.id ? "text-white/60" : "text-gray-400"}`}>{c.matricule}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <>
          {/* Child profile card */}
          <div className="rounded-2xl bg-gradient-to-br from-[#0F1E3C] to-[#1B3A6B] p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFD166] text-2xl font-bold text-[#0F1E3C]">
                {selected.user.firstName[0]}{selected.user.lastName[0]}
              </div>
              <div>
                <h2 className="text-xl font-bold">{selected.user.firstName} {selected.user.lastName}</h2>
                <p className="text-white/60 text-sm">{selected.matricule}</p>
                <div className="flex gap-3 mt-1">
                  {selected.promotion && (
                    <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">{selected.promotion.mention.name}</span>
                  )}
                  <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">Niveau {selected.level}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Moyenne", value: bulletin?.average != null ? `${bulletin.average.toFixed(2)}/20` : "—", icon: <TrendingUp size={18} className="text-blue-600" />, bg: "bg-blue-50" },
              { label: "GPA", value: bulletin?.gpa != null ? bulletin.gpa.toFixed(2) : "—", icon: <TrendingUp size={18} className="text-green-600" />, bg: "bg-green-50" },
              { label: "Matières validées", value: passedSubjects, icon: <CheckCircle size={18} className="text-purple-600" />, bg: "bg-purple-50" },
              { label: "Matières à repasser", value: failedSubjects, icon: <AlertCircle size={18} className="text-red-500" />, bg: "bg-red-50" },
            ].map(s => (
              <div key={s.label} className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
                <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${s.bg}`}>{s.icon}</div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-sm text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Grades */}
          {bulletin && bulletin.subjects.length > 0 && (
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Notes par matière</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-50">
                      {["Matière", "Code", "Note", "Coeff.", "Résultat"].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bulletin.subjects.map(s => (
                      <tr key={s.code} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{s.name}</td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{s.code}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-sm font-bold ${s.grade != null && s.grade >= 10 ? "text-green-600" : s.grade != null ? "text-red-500" : "text-gray-400"}`}>
                            {s.grade != null ? `${s.grade.toFixed(2)}/20` : "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-500">{s.coefficient}</td>
                        <td className="px-5 py-3.5">
                          {s.isPassed === true && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                              <CheckCircle size={11} /> Validé
                            </span>
                          )}
                          {s.isPassed === false && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-600">
                              <AlertCircle size={11} /> À repasser
                            </span>
                          )}
                          {s.isPassed === null && (
                            <span className="text-xs text-gray-400">En cours</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payments shortcut */}
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-50">
              <CreditCard size={20} className="text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Suivi des paiements</p>
              <p className="text-sm text-gray-500">Consultez les factures et effectuez les règlements.</p>
            </div>
            <button className="shrink-0 rounded-xl bg-[#0F1E3C] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1B3A6B] transition-colors">
              Voir les factures
            </button>
          </div>
        </>
      )}
    </div>
  );
}
