import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight, BookOpen, Calendar, ChevronRight, Clock,
  Loader2, Send, TrendingUp, Users, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { displayRoleName, useRequireClassroom } from "@/components/classroom/shared";
import { api } from "@/lib/api";

export const Route = createFileRoute("/classroom/chef-mention")({ component: ChefMentionDash });

// ── types ─────────────────────────────────────────────────────────────
type Period = {
  id: string; name: string; status: string;
  availabilityDeadline: string | null; publishAt: string | null;
  mention: { name: string; code: string };
  semester: { name: string };
  _count: { slots: number; availabilities: number };
  validation: { validatedAt: string } | null;
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string; icon: React.ReactNode }> = {
  PREPARING: {
    label: "Collecte des disponibilités", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200",
    dot: "bg-yellow-400",
    icon: <Clock className="h-5 w-5 text-yellow-500" />,
  },
  BUILDING: {
    label: "En construction", color: "text-blue-700", bg: "bg-blue-50 border-blue-200",
    dot: "bg-blue-500",
    icon: <Calendar className="h-5 w-5 text-blue-500" />,
  },
  VALIDATED: {
    label: "Validé", color: "text-green-700", bg: "bg-green-50 border-green-200",
    dot: "bg-green-500",
    icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
  },
  PUBLISHED: {
    label: "Publié", color: "text-classroom", bg: "bg-classroom/5 border-classroom/20",
    dot: "bg-classroom",
    icon: <Send className="h-5 w-5 text-classroom" />,
  },
};

// ── Component ─────────────────────────────────────────────────────────
function ChefMentionDash() {
  const { user, roles, ready } = useRequireClassroom(["STAFF"]);

  const [periods, setPeriods]   = useState<Period[]>([]);
  const [loading, setLoading]   = useState(true);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!ready) return;
    api<Period[]>("/schedule/periods")
      .then((ps) => setPeriods(ps as Period[]))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ready]);

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const scope     = roles[0]?.scope;
  const roleName  = displayRoleName(roles[0]?.roleName) || "Responsable Pédagogique";
  const now       = new Date();
  const greeting  = now.getHours() < 12 ? "Bonjour" : now.getHours() < 18 ? "Bon après-midi" : "Bonsoir";

  // Most recent active period
  const activePeriod = periods.find((p) => ["PREPARING","BUILDING"].includes(p.status))
    ?? periods.find((p) => p.status === "VALIDATED")
    ?? periods[0]
    ?? null;

  const meta = activePeriod ? (STATUS_META[activePeriod.status] ?? STATUS_META.PREPARING) : null;

  // Derive stats from period data
  const totalAvail = activePeriod?._count.availabilities ?? 0;
  const totalSlots = activePeriod?._count.slots ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div
        className="animate-in fade-in slide-in-from-bottom-4 duration-700 relative overflow-hidden rounded-3xl grad-hero p-6 lg:p-8"
        style={{ animationFillMode: "both" }}
      >
        <div className="noise-bg absolute inset-0 opacity-40" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-white/60">
              {now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="mt-1 text-3xl font-bold text-white">
              {greeting} 👋
            </h1>
            <p className="mt-0.5 text-white/80 font-medium">{roleName}</p>
            {scope?.mentionName && (
              <p className="text-sm text-white/60">Mention : {scope.mentionName}</p>
            )}

            {/* Active period badge */}
            {activePeriod && (
              <div className="mt-4 inline-flex items-center gap-3 rounded-2xl bg-white/10 backdrop-blur-sm px-4 py-3 border border-white/20">
                {meta?.icon}
                <div>
                  <p className="text-sm font-semibold text-white">{activePeriod.name}</p>
                  <p className="text-xs text-white/70">{meta?.label}</p>
                </div>
                <Link
                  to="/classroom/planning/$id"
                  params={{ id: activePeriod.id }}
                  className="ml-2 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/30 transition-colors"
                >
                  Gérer →
                </Link>
              </div>
            )}
            {!activePeriod && !loading && (
              <Link
                to="/classroom/planning"
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white border border-white/20 hover:bg-white/20 transition-colors"
              >
                <Calendar className="h-4 w-4" /> Créer une période de planification
              </Link>
            )}
          </div>

          {/* Quick stat badges */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { v: String(periods.length), l: "Périodes" },
              { v: String(totalSlots),     l: "Créneaux placés" },
              { v: String(totalAvail),     l: "Disponibilités" },
              { v: periods.filter((p) => p.status === "PUBLISHED").length.toString(), l: "Publiés" },
            ].map(({ v, l }) => (
              <div key={l} className="rounded-2xl bg-white/10 border border-white/20 px-4 py-3 text-center backdrop-blur-sm">
                <p className="text-xl font-bold text-white">{v}</p>
                <p className="text-[10px] text-white/60 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Status cards ──────────────────────────────────────── */}
      {activePeriod && meta && (
        <div
          className="animate-in fade-in slide-in-from-bottom-3 duration-500 rounded-2xl border bg-card shadow-elegant overflow-hidden"
          style={{ animationDelay: "150ms", animationFillMode: "both" }}
        >
          <div className={`flex items-center gap-4 border-b px-5 py-4 ${meta.bg} border`}>
            <div className={`flex h-2 w-2 rounded-full ${meta.dot}`} />
            <div className="flex-1 min-w-0">
              <p className={`font-semibold ${meta.color}`}>{activePeriod.name}</p>
              <p className={`text-xs ${meta.color} opacity-70`}>{activePeriod.mention.name} · {activePeriod.semester.name}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${meta.bg} ${meta.color}`}>
              {meta.label}
            </span>
          </div>

          <div className="grid divide-x sm:grid-cols-3">
            {[
              {
                icon: <Users className="h-5 w-5 text-blue-500" />,
                label: "Disponibilités reçues",
                value: String(totalAvail),
                sub: activePeriod.availabilityDeadline
                  ? `Limite : ${new Date(activePeriod.availabilityDeadline).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
                  : "Pas de date limite",
                accent: "blue",
              },
              {
                icon: <BookOpen className="h-5 w-5 text-purple-500" />,
                label: "Créneaux placés",
                value: String(totalSlots),
                sub: totalSlots === 0 ? "Aucun cours ajouté" : "Voir la grille →",
                accent: "purple",
              },
              {
                icon: <TrendingUp className="h-5 w-5 text-green-500" />,
                label: "Statut",
                value: meta.label,
                sub: activePeriod.publishAt
                  ? `Publication : ${new Date(activePeriod.publishAt).toLocaleDateString("fr-FR")}`
                  : "Publication manuelle",
                accent: "green",
              },
            ].map(({ icon, label, value, sub }) => (
              <div key={label} className="flex items-start gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                  {icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-0.5 text-2xl font-bold leading-none">{value}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Progress bar for BUILDING state */}
          {activePeriod.status === "BUILDING" && totalSlots > 0 && (
            <div className="border-t px-5 py-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>Avancement</span>
                <span>{totalSlots} créneaux</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full grad-classroom rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, (totalSlots / 30) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Action row */}
          <div className="flex flex-wrap gap-2 border-t bg-muted/20 px-5 py-3">
            <Link
              to="/classroom/planning/$id"
              params={{ id: activePeriod.id }}
              className="inline-flex items-center gap-2 rounded-xl grad-classroom px-4 py-2 text-sm font-semibold text-white shadow-elegant"
            >
              <Calendar className="h-4 w-4" />
              {activePeriod.status === "PREPARING" ? "Voir les disponibilités" : "Gérer l'emploi du temps"}
            </Link>
            {activePeriod.status === "PUBLISHED" && (
              <Link
                to="/classroom/planning/view/$id"
                params={{ id: activePeriod.id }}
                className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
              >
                Vue publique <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── All periods ───────────────────────────────────────── */}
      <div
        className="animate-in fade-in slide-in-from-bottom-3 duration-500 rounded-2xl border bg-card shadow-elegant"
        style={{ animationDelay: "300ms", animationFillMode: "both" }}
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">Toutes les périodes</h2>
          <Link to="/classroom/planning"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-classroom transition-colors">
            Gérer <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : periods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
            <Calendar className="mb-3 h-10 w-10" />
            <p className="text-sm font-medium">Aucune période créée</p>
            <Link to="/classroom/planning"
              className="mt-3 inline-flex items-center gap-2 rounded-xl grad-classroom px-4 py-2 text-sm font-semibold text-white shadow-elegant">
              Créer la première période
            </Link>
          </div>
        ) : (
          <div className="divide-y">
            {periods.map((p, i) => {
              const m = STATUS_META[p.status] ?? STATUS_META.PREPARING;
              return (
                <Link
                  key={p.id}
                  to="/classroom/planning/$id"
                  params={{ id: p.id }}
                  className="animate-in fade-in slide-in-from-left-2 duration-300 flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors group"
                  style={{ animationDelay: `${350 + i * 50}ms`, animationFillMode: "both" }}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${m.bg}`}>
                    <div className={`h-3 w-3 rounded-full ${m.dot}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground group-hover:text-classroom transition-colors">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.mention.name} · {p.semester.name}</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                      <span>{p._count.slots} créneaux</span>
                      <span>{p._count.availabilities} disponibilités</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${m.bg} ${m.color}`}>
                      {m.label}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 group-hover:text-classroom transition-colors" />
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Alerts / Tips ─────────────────────────────────────── */}
      {activePeriod?.status === "PREPARING" && totalAvail === 0 && (
        <div
          className="animate-in fade-in duration-500 flex items-start gap-3 rounded-2xl border border-yellow-200 bg-yellow-50 p-4"
          style={{ animationDelay: "400ms", animationFillMode: "both" }}
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">En attente de disponibilités</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              Les enseignants n'ont pas encore soumis leurs disponibilités pour <strong>{activePeriod.name}</strong>.
              {activePeriod.availabilityDeadline
                ? ` Date limite : ${new Date(activePeriod.availabilityDeadline).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}.`
                : ""}
            </p>
          </div>
        </div>
      )}

      {activePeriod?.status === "BUILDING" && totalSlots === 0 && (
        <div
          className="animate-in fade-in duration-500 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4"
          style={{ animationDelay: "400ms", animationFillMode: "both" }}
        >
          <Calendar className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Prêt à construire</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Les disponibilités ont été collectées. Vous pouvez maintenant placer les créneaux de cours.
            </p>
            <Link
              to="/classroom/planning/$id"
              params={{ id: activePeriod.id }}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
            >
              Accéder au constructeur <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
