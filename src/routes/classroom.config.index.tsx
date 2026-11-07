import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Users, DoorOpen, BookOpen, GraduationCap, ChevronRight, CheckCircle2 } from "lucide-react";
import { useFaculties, useDepartments, useMentions, useParcours } from "@/lib/academic";
import { useRooms, useAdminUsers } from "@/lib/config";

export const Route = createFileRoute("/classroom/config/")({ component: ConfigIndex });

function StatCard({
  icon, label, value, sublabel, link, delay = 0
}: {
  icon: React.ReactNode; label: string; value: number | string;
  sublabel?: string; link: string; delay?: number;
}) {
  return (
    <Link
      to={link}
      className="animate-in fade-in slide-in-from-bottom-3 duration-500 group flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-elegant transition-all hover:shadow-lg hover:-translate-y-0.5"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-classroom/10 text-classroom">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="mt-0.5 font-medium">{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
      </div>
      <ChevronRight size={16} className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function ConfigIndex() {
  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: mentions } = useMentions();
  const { data: parcours } = useParcours();
  const { data: rooms } = useRooms();
  const { data: users } = useAdminUsers();

  const WORKFLOW = [
    { step: 1, label: "Facultés créées",    done: (faculties?.length ?? 0) > 0 },
    { step: 2, label: "Départements créés", done: (departments?.length ?? 0) > 0 },
    { step: 3, label: "Mentions créées",    done: (mentions?.length ?? 0) > 0 },
    { step: 4, label: "Parcours créés",     done: (parcours?.length ?? 0) > 0 },
    { step: 5, label: "Salles configurées", done: (rooms?.length ?? 0) > 0 },
    { step: 6, label: "Utilisateurs créés", done: (users?.total ?? 0) > 0 },
  ];
  const doneCount = WORKFLOW.filter((w) => w.done).length;

  return (
    <div className="space-y-8">
      {/* Completion banner */}
      <div
        className="animate-in fade-in slide-in-from-bottom-2 duration-500 relative overflow-hidden rounded-2xl grad-hero p-5 lg:p-6"
        style={{ animationFillMode: "both" }}
      >
        <div className="noise-bg absolute inset-0 opacity-40" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/70">Progression</p>
            <p className="text-2xl font-bold text-white">{doneCount}/{WORKFLOW.length} étapes complètes</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {WORKFLOW.map((w) => (
              <div
                key={w.step}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  w.done ? "bg-white text-emerald-700" : "bg-white/15 text-white/60"
                }`}
              >
                {w.done ? <CheckCircle2 size={12} /> : <span className="h-3 w-3 rounded-full border border-white/40" />}
                {w.label}
              </div>
            ))}
          </div>
        </div>
        {/* Progress bar */}
        <div className="relative mt-4 h-1.5 w-full rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white transition-all duration-500"
            style={{ width: `${(doneCount / WORKFLOW.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div>
        <h2 className="mb-4 text-base font-semibold">Structure académique</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard icon={<Building2 size={20} />} label="Facultés"    value={faculties?.length ?? "—"} link="/classroom/config/structure" delay={0} />
          <StatCard icon={<Building2 size={20} />} label="Départements" value={departments?.length ?? "—"} sublabel="répartis dans les facultés" link="/classroom/config/structure" delay={80} />
          <StatCard icon={<BookOpen size={20} />}  label="Mentions"    value={mentions?.length ?? "—"}  sublabel="programmes d'enseignement" link="/classroom/config/structure" delay={160} />
          <StatCard icon={<GraduationCap size={20} />} label="Parcours" value={parcours?.length ?? "—"} sublabel="spécialisations" link="/classroom/config/structure" delay={240} />
          <StatCard icon={<DoorOpen size={20} />} label="Salles & Labos" value={rooms?.length ?? "—"} sublabel="espaces d'enseignement" link="/classroom/config/salles" delay={320} />
          <StatCard icon={<Users size={20} />} label="Utilisateurs" value={users?.total ?? "—"} sublabel="comptes actifs" link="/classroom/config/utilisateurs" delay={400} />
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="mb-4 text-base font-semibold">Actions rapides</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: <Building2 size={18} />, label: "Gérer la structure", sub: "Facultés, Depts, Mentions, Parcours", to: "/classroom/config/structure" },
            { icon: <DoorOpen size={18} />,  label: "Gérer les salles",   sub: "Salles, Amphithéâtres, Labos",      to: "/classroom/config/salles" },
            { icon: <Users size={18} />,     label: "Gérer les utilisateurs", sub: "Comptes, rôles, permissions",   to: "/classroom/config/utilisateurs" },
          ].map((a, i) => (
            <Link
              key={a.to}
              to={a.to}
              className="animate-in fade-in slide-in-from-bottom-2 duration-400 group flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-elegant hover:shadow-lg hover:-translate-y-0.5 transition-all"
              style={{ animationDelay: `${i * 80 + 500}ms`, animationFillMode: "both" }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl grad-classroom text-white">
                {a.icon}
              </div>
              <div className="min-w-0">
                <p className="font-semibold">{a.label}</p>
                <p className="text-xs text-muted-foreground">{a.sub}</p>
              </div>
              <ChevronRight size={14} className="ml-auto shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
