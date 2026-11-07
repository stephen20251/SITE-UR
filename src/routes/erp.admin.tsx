import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  Users, GraduationCap, BookOpen, FileText, Building2,
  School, TrendingUp, UserPlus, Settings, ChevronRight,
  CheckCircle, Clock, XCircle, Eye
} from "lucide-react";

export const Route = createFileRoute("/erp/admin")({
  component: AdminDashboard,
});

type Stats = {
  users: number; students: number; teachers: number;
  pendingCandidates: number; mentions: number; promotions: number;
};
type User = { id: string; firstName: string; lastName: string; email: string; systemRole: string; isActive: boolean; createdAt: string; userRoles?: { role: { name: string; color: string } }[] };

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin", STAFF: "Personnel", TEACHER: "Enseignant",
  STUDENT: "Étudiant", PARENT: "Parent", CANDIDATE: "Candidat",
};
const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-700", STAFF: "bg-purple-100 text-purple-700",
  TEACHER: "bg-blue-100 text-blue-700", STUDENT: "bg-green-100 text-green-700",
  PARENT: "bg-orange-100 text-orange-700", CANDIDATE: "bg-gray-100 text-gray-600",
};

function StatCard({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: number; color: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
      <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<Stats>("/admin/stats"),
      api<{ users: User[] }>("/admin/users?limit=8"),
    ]).then(([s, u]) => {
      setStats(s);
      setUsers(u.users);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0F1E3C] border-t-[#FFD166]" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vue d'ensemble de l'université</p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Settings size={15} /> Paramètres
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F1E3C] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B3A6B] transition-colors">
            <UserPlus size={15} /> Nouvel utilisateur
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard icon={<Users size={20} className="text-purple-600" />} label="Utilisateurs" value={stats.users} color="bg-purple-50" />
          <StatCard icon={<GraduationCap size={20} className="text-blue-600" />} label="Étudiants actifs" value={stats.students} color="bg-blue-50" />
          <StatCard icon={<BookOpen size={20} className="text-green-600" />} label="Enseignants" value={stats.teachers} color="bg-green-50" />
          <StatCard icon={<FileText size={20} className="text-orange-500" />} label="Candidatures" value={stats.pendingCandidates} color="bg-orange-50" sub="en attente" />
          <StatCard icon={<School size={20} className="text-pink-600" />} label="Mentions" value={stats.mentions} color="bg-pink-50" />
          <StatCard icon={<Building2 size={20} className="text-cyan-600" />} label="Promotions" value={stats.promotions} color="bg-cyan-50" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Users table */}
        <div className="lg:col-span-2 rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Utilisateurs récents</h2>
            <button className="text-xs text-[#0F1E3C] font-medium hover:underline inline-flex items-center gap-1">
              Voir tout <ChevronRight size={13} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  {["Utilisateur", "Rôle", "Statut", ""].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F1E3C] text-xs font-bold text-[#FFD166]">
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {u.userRoles?.[0] ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ background: `${u.userRoles[0].role.color}20`, color: u.userRoles[0].role.color }}>
                          {u.userRoles[0].role.name}
                        </span>
                      ) : (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLOR[u.systemRole] ?? "bg-gray-100 text-gray-600"}`}>
                          {ROLE_LABEL[u.systemRole] ?? u.systemRole}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${u.isActive ? "text-green-600" : "text-red-500"}`}>
                        {u.isActive ? <CheckCircle size={13} /> : <XCircle size={13} />}
                        {u.isActive ? "Actif" : "Bloqué"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button className="text-gray-400 hover:text-gray-700 transition-colors"><Eye size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Actions rapides</h2>
            <div className="space-y-2">
              {[
                { icon: <UserPlus size={16} />, label: "Créer un utilisateur", color: "text-purple-600 bg-purple-50" },
                { icon: <School size={16} />, label: "Nouvelle mention", color: "text-blue-600 bg-blue-50" },
                { icon: <Building2 size={16} />, label: "Nouvelle promotion", color: "text-green-600 bg-green-50" },
                { icon: <BookOpen size={16} />, label: "Créer un cours", color: "text-orange-600 bg-orange-50" },
                { icon: <TrendingUp size={16} />, label: "Voir les rapports", color: "text-pink-600 bg-pink-50" },
              ].map(a => (
                <button key={a.label} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors group">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.color}`}>{a.icon}</span>
                  {a.label}
                  <ChevronRight size={14} className="ml-auto text-gray-300 group-hover:text-gray-500" />
                </button>
              ))}
            </div>
          </div>

          {/* Pending candidates */}
          <div className="rounded-2xl bg-gradient-to-br from-[#0F1E3C] to-[#1B3A6B] p-5 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-[#FFD166]" />
              <h3 className="font-semibold text-sm">Candidatures en attente</h3>
            </div>
            <p className="text-3xl font-bold text-[#FFD166]">{stats?.pendingCandidates ?? 0}</p>
            <p className="text-white/60 text-xs mt-1">dossiers à examiner</p>
            <button className="mt-4 w-full rounded-lg bg-[#FFD166] py-2 text-xs font-bold text-[#0F1E3C] hover:bg-yellow-300 transition-colors">
              Traiter les candidatures
            </button>
          </div>
        </div>
      </div>

      {/* Structure overview */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { title: "3 Facultés", sub: "Sciences · Économie · Lettres", icon: <Building2 size={18} className="text-blue-600" />, bg: "bg-blue-50" },
          { title: "3 Mentions", sub: "Informatique · Gestion · Anglais", icon: <School size={18} className="text-purple-600" />, bg: "bg-purple-50" },
          { title: "2 Promotions", sub: "L1 Informatique · L1 Gestion", icon: <GraduationCap size={18} className="text-green-600" />, bg: "bg-green-50" },
        ].map(c => (
          <div key={c.title} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 flex items-center gap-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.bg}`}>{c.icon}</div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{c.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
