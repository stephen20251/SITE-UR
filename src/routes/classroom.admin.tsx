import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Users, GraduationCap, UserCheck, BookOpen, Layers } from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";
import { useReportsOverview, useUsers } from "@/lib/classroom";

export const Route = createFileRoute("/classroom/admin")({ component: AdminDash });

const STAFF_ROLES = ["SUPER_ADMIN", "STAFF"];

function AdminDash() {
  const { user, ready } = useRequireClassroom(STAFF_ROLES);
  const navigate = useNavigate();
  const enabled = ready && !!user;

  const reports = useReportsOverview({ enabled });
  const recentUsers = useUsers(undefined, { enabled });

  if (!ready || !user) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const stats = reports.data;
  const users = recentUsers.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
        <p className="text-muted-foreground">Vue globale de l'université — statistiques en temps réel.</p>
      </div>

      {reports.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Utilisateurs total",   value: stats ? String(stats.users)             : "—", icon: <Users size={18} />,        cls: "text-classroom bg-classroom/10" },
              { label: "Étudiants actifs",     value: stats ? String(stats.students)          : "—", icon: <GraduationCap size={18} />, cls: "text-blue-600 bg-blue-100 dark:bg-blue-950/30" },
              { label: "Enseignants",          value: stats ? String(stats.teachers)          : "—", icon: <UserCheck size={18} />,     cls: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950/30" },
              { label: "Candidats en attente", value: stats ? String(stats.pendingCandidates) : "—", icon: <Users size={18} />,        cls: "text-amber-600 bg-amber-100 dark:bg-amber-950/30", to: "/classroom/candidatures" },
              { label: "Mentions actives",     value: stats ? String(stats.mentions)          : "—", icon: <BookOpen size={18} />,     cls: "text-violet-600 bg-violet-100 dark:bg-violet-950/30" },
              { label: "Promotions",           value: stats ? String(stats.promotions)        : "—", icon: <Layers size={18} />,       cls: "text-rose-600 bg-rose-100 dark:bg-rose-950/30" },
            ].map((s: { label: string; value: string; icon: React.ReactNode; cls: string; to?: string }) => (
              <div key={s.label} onClick={s.to ? () => navigate({ to: s.to! }) : undefined} role={s.to ? "link" : undefined}
                title={s.to ? "Voir la liste des candidats" : undefined}
                className={`flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-elegant ${s.to ? "cursor-pointer transition hover:bg-accent" : ""}`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.cls}`}>{s.icon}</div>
                <div>
                  <p className="text-xl font-bold leading-none">{s.value}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Utilisateurs récents */}
      <div className="rounded-2xl border bg-card shadow-elegant overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="font-semibold">Utilisateurs récents</h3>
          <Users className="h-4 w-4 text-muted-foreground" />
        </div>
        {recentUsers.isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : users.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Aucun utilisateur trouvé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr className="text-left">
                  <th className="p-4">Nom</th>
                  <th className="p-4">Rôle</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Statut</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(0, 10).map((u) => (
                  <tr key={u.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium">{u.firstName} {u.lastName}</td>
                    <td className="p-4 text-xs text-muted-foreground">{u.role.replace(/_/g, " ")}</td>
                    <td className="p-4 text-muted-foreground">{u.email}</td>
                    <td className="p-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                        {u.isActive ? "Actif" : "Inactif"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
