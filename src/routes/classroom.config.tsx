import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { Building2, Users, DoorOpen, BookOpen, Settings2, Layers, Palette, GraduationCap } from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";

export const Route = createFileRoute("/classroom/config")({ component: ConfigLayout });

type Tab = { path: string; label: string; icon: React.ReactNode; exact?: boolean };
const TABS: Tab[] = [
  { path: "/classroom/config",              label: "Vue d'ensemble", icon: <Settings2 size={15} />, exact: true },
  { path: "/classroom/config/structure",    label: "Structure",       icon: <Building2 size={15} /> },
  { path: "/classroom/config/matieres",     label: "Matières & UE",   icon: <Layers size={15} /> },
  { path: "/classroom/config/salles",       label: "Salles & Labos",  icon: <DoorOpen size={15} /> },
  { path: "/classroom/config/utilisateurs", label: "Utilisateurs",    icon: <Users size={15} /> },
  { path: "/classroom/config/branding",     label: "Identité visuelle",   icon: <Palette size={15} /> },
  { path: "/classroom/config/universite",   label: "Paramètres université", icon: <GraduationCap size={15} /> },
];

function ConfigLayout() {
  const { user, ready } = useRequireClassroom(["SUPER_ADMIN"]);
  const location = useLocation();

  if (!ready || !user) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="animate-in fade-in slide-in-from-bottom-3 duration-500" style={{ animationFillMode: "both" }}>
        <h1 className="text-2xl font-bold tracking-tight">Configuration de l'université</h1>
        <p className="text-sm text-muted-foreground">Données permanentes — Facultés, Départements, Mentions, Salles, Utilisateurs</p>
      </div>

      {/* Sub-nav tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {TABS.map((t) => {
          const active = t.exact
            ? location.pathname === t.path
            : location.pathname.startsWith(t.path);
          return (
            <Link
              key={t.path}
              to={t.path}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                active
                  ? "bg-white dark:bg-gray-800 shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon} {t.label}
            </Link>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}
