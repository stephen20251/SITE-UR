import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { FileText, CheckCircle, XCircle, Clock, UserPlus, Search, Eye, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/erp/secretaire")({
  component: SecretaireDashboard,
});

type Candidate = {
  id: string; status: string; level: string | null; submittedAt: string | null;
  mention: { name: string; code: string } | null;
  user: { id: string; firstName: string; lastName: string; email: string; createdAt: string };
};

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  DRAFT:        { label: "Brouillon",    cls: "bg-gray-100 text-gray-500",   icon: <Clock size={12} /> },
  SUBMITTED:    { label: "Soumis",       cls: "bg-blue-100 text-blue-700",   icon: <Clock size={12} /> },
  UNDER_REVIEW: { label: "En examen",    cls: "bg-yellow-100 text-yellow-700", icon: <Eye size={12} /> },
  ACCEPTED:     { label: "Accepté",      cls: "bg-green-100 text-green-700", icon: <CheckCircle size={12} /> },
  REJECTED:     { label: "Refusé",       cls: "bg-red-100 text-red-600",     icon: <XCircle size={12} /> },
  ENROLLED:     { label: "Inscrit",      cls: "bg-purple-100 text-purple-700", icon: <CheckCircle size={12} /> },
};

function SecretaireDashboard() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = () => {
    const params = new URLSearchParams();
    if (filter !== "ALL") params.set("status", filter);
    if (search) params.set("search", search);
    api<{ total: number; candidates: Candidate[] }>(`/candidates?${params}`)
      .then(r => setCandidates(r.candidates))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter, search]);

  const doAction = async (id: string, action: "review" | "accept" | "reject") => {
    setActionId(id);
    try {
      await api(`/candidates/${id}/${action}`, { method: "PUT", body: action === "reject" ? { reason: "Dossier incomplet" } : {} });
      load();
    } catch (e) { console.error(e); }
    finally { setActionId(null); }
  };

  const counts = {
    total: candidates.length,
    submitted: candidates.filter(c => c.status === "SUBMITTED").length,
    accepted: candidates.filter(c => c.status === "ACCEPTED").length,
    enrolled: candidates.filter(c => c.status === "ENROLLED").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admissions & Candidatures</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gérez les dossiers d'admission des candidats.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-[#0F1E3C] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1B3A6B] transition-colors">
          <UserPlus size={16} /> Inscrire manuellement
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total candidatures", value: counts.total, cls: "bg-blue-50", icon: <FileText size={18} className="text-blue-600" /> },
          { label: "À traiter", value: counts.submitted, cls: "bg-yellow-50", icon: <Clock size={18} className="text-yellow-600" /> },
          { label: "Acceptés", value: counts.accepted, cls: "bg-green-50", icon: <CheckCircle size={18} className="text-green-600" /> },
          { label: "Inscrits", value: counts.enrolled, cls: "bg-purple-50", icon: <CheckCircle size={18} className="text-purple-600" /> },
        ].map(s => (
          <div key={s.label} className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${s.cls}`}>{s.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un candidat…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-[#0F1E3C] focus:ring-2 focus:ring-[#0F1E3C]/10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["ALL", "SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "REJECTED", "ENROLLED"].map(s => (
            <button key={s}
              onClick={() => setFilter(s)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${filter === s ? "bg-[#0F1E3C] text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {s === "ALL" ? "Tous" : STATUS_CONFIG[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-[#0F1E3C] border-t-transparent" />
          </div>
        ) : candidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FileText size={40} className="mb-3 opacity-40" />
            <p className="font-medium">Aucune candidature</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Candidat", "Mention demandée", "Niveau", "Soumis le", "Statut", "Actions"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {candidates.map(c => {
                  const sc = STATUS_CONFIG[c.status];
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0F1E3C]/10 text-xs font-bold text-[#0F1E3C]">
                            {c.user.firstName[0]}{c.user.lastName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{c.user.firstName} {c.user.lastName}</p>
                            <p className="text-xs text-gray-400">{c.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {c.mention ? (
                          <span className="text-sm font-medium text-gray-700">{c.mention.name}</span>
                        ) : <span className="text-xs text-gray-400">Non choisi</span>}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{c.level ?? "—"}</span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-500">
                        {c.submittedAt ? new Date(c.submittedAt).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${sc?.cls ?? ""}`}>
                          {sc?.icon}{sc?.label ?? c.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          {c.status === "SUBMITTED" && (
                            <button onClick={() => doAction(c.id, "review")}
                              disabled={actionId === c.id}
                              className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50">
                              Examiner
                            </button>
                          )}
                          {c.status === "UNDER_REVIEW" && (<>
                            <button onClick={() => doAction(c.id, "accept")} disabled={actionId === c.id}
                              className="rounded-lg bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50">
                              Accepter
                            </button>
                            <button onClick={() => doAction(c.id, "reject")} disabled={actionId === c.id}
                              className="rounded-lg bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50">
                              Refuser
                            </button>
                          </>)}
                          {c.status === "ACCEPTED" && (
                            <button className="rounded-lg bg-purple-50 border border-purple-200 px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors">
                              Inscrire
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
