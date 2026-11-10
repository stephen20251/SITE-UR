import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Calendar, Plus, ChevronRight, Loader2, Star, Archive,
  Clock, CheckCircle2, BookOpen, Users, GraduationCap,
  AlertCircle, X, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useRequireClassroom } from "@/components/classroom/shared";
import {
  useAcademicYears, useCreateAcademicYear, deriveYearStatus,
  type AcademicYear, type AcademicYearStatus,
} from "@/lib/academic";

export const Route = createFileRoute("/classroom/annees/")({ component: AnneesPage });

// ─── Status meta ─────────────────────────────────────────────────────────────

type StatusMeta = { label: string; textCls: string; bgCls: string; icon: React.ReactNode };
const STATUS_META: Record<AcademicYearStatus, StatusMeta> = {
  DRAFT: {
    label: "Brouillon",
    textCls: "text-gray-500",
    bgCls: "bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700",
    icon: <Clock size={13} />,
  },
  PREPARATION: {
    label: "Préparation",
    textCls: "text-amber-700 dark:text-amber-400",
    bgCls: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
    icon: <Clock size={13} />,
  },
  ACTIVE: {
    label: "Année active",
    textCls: "text-emerald-700 dark:text-emerald-400",
    bgCls: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
    icon: <CheckCircle2 size={13} />,
  },
  CLOSED: {
    label: "Clôturée",
    textCls: "text-blue-700 dark:text-blue-400",
    bgCls: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
    icon: <BookOpen size={13} />,
  },
  ARCHIVED: {
    label: "Archivée",
    textCls: "text-gray-500 dark:text-gray-400",
    bgCls: "bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700",
    icon: <Archive size={13} />,
  },
};

// ─── Year card ───────────────────────────────────────────────────────────────

function YearCard({ year, delay = 0 }: { year: AcademicYear; delay?: number }) {
  const st = deriveYearStatus(year);
  const meta = STATUS_META[st];
  const totalSemesters = year.semesters?.length ?? 0;

  return (
    <Link
      to="/classroom/annees/$id"
      params={{ id: year.id }}
      className={[
        "animate-in fade-in slide-in-from-bottom-3 duration-500 group relative flex flex-col rounded-2xl border bg-card p-6 shadow-elegant transition-all hover:shadow-lg hover:-translate-y-0.5",
        year.isCurrent ? "ring-2 ring-classroom/40" : "",
      ].join(" ")}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      {year.isCurrent && (
        <div className="absolute -top-2.5 left-6 flex items-center gap-1.5 rounded-full grad-classroom px-3 py-0.5 text-[11px] font-bold text-white shadow-sm">
          <Star size={10} fill="currentColor" /> Année en cours
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${year.isCurrent ? "grad-classroom" : "bg-muted"}`}>
            <Calendar size={19} className={year.isCurrent ? "text-white" : "text-muted-foreground"} />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight">{year.label}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {format(new Date(year.startDate), "d MMM yyyy", { locale: fr })}
              {" — "}
              {format(new Date(year.endDate), "d MMM yyyy", { locale: fr })}
            </p>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.bgCls} ${meta.textCls}`}>
          {meta.icon} {meta.label}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          { icon: <Calendar size={14} />, value: totalSemesters, label: "Semestres" },
          { icon: <GraduationCap size={14} />, value: year._count?.promotions ?? 0, label: "Promotions" },
          { icon: <Users size={14} />, value: year._studentCount ?? 0, label: "Étudiants" },
        ].map((s) => (
          <div key={s.label} className="flex flex-col items-center rounded-xl bg-muted/50 py-3 px-2 text-center">
            <span className="mb-1 text-muted-foreground">{s.icon}</span>
            <span className="text-lg font-bold leading-none">{s.value}</span>
            <span className="mt-0.5 text-[10px] text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-end gap-1 text-xs font-medium text-classroom opacity-0 transition-opacity group-hover:opacity-100">
        Voir le détail <ChevronRight size={13} />
      </div>
    </Link>
  );
}

// ─── Create dialog ────────────────────────────────────────────────────────────

function CreateYearDialog({ campusId, onClose }: { campusId: string; onClose: () => void }) {
  const createYear = useCreateAcademicYear();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    label: "",
    startDate: "",
    endDate: "",
  });

  const inp = "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-classroom/30 transition";

  async function submit() {
    try {
      await createYear.mutateAsync({
        label: form.label,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        campusId,
      });
      toast.success(`Année ${form.label} créée avec succès`);
      onClose();
    } catch {
      toast.error("Erreur lors de la création de l'année");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="animate-in fade-in zoom-in-95 duration-200 w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold">Nouvelle année universitaire</h2>
            <p className="text-sm text-muted-foreground">Étape {step} sur 2</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent">
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-6 h-1.5 w-full rounded-full bg-muted">
          <div
            className="h-full rounded-full grad-classroom transition-all duration-300"
            style={{ width: step === 1 ? "50%" : "100%" }}
          />
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Libellé de l'année</label>
              <input
                className={inp}
                placeholder="ex: 2025-2026"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
              <p className="mt-1 text-xs text-muted-foreground">Format recommandé : AAAA-AAAA</p>
            </div>
            <button
              disabled={!form.label.trim()}
              onClick={() => setStep(2)}
              className="flex w-full items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Suivant <ArrowRight size={14} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Date de début</label>
              <input type="date" className={inp} value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Date de fin</label>
              <input type="date" className={inp} value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:bg-amber-950/20 dark:border-amber-800">
              <div className="flex gap-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>L'année sera créée en mode <strong>Préparation</strong>. Vous pourrez l'activer une fois que tout est configuré.</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold hover:bg-accent">
                Retour
              </button>
              <button
                disabled={!form.startDate || !form.endDate || createYear.isPending}
                onClick={submit}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {createYear.isPending && <Loader2 size={14} className="animate-spin" />}
                Créer l'année
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AnneesPage() {
  const { user, ready } = useRequireClassroom(["SUPER_ADMIN", "STAFF"]);
  const { data: years, isLoading } = useAcademicYears();
  // Campus de l'université : nécessaire pour créer la toute première année (aucune année
  // existante dont on pourrait le reprendre sur une installation neuve).
  const { data: campuses } = useQuery({
    queryKey: ["academic", "campuses"],
    queryFn: () => api<{ id: string; name: string }[]>("/structure/campuses"),
    staleTime: 5 * 60_000,
  });
  const [creating, setCreating] = useState(false);

  if (!ready || !user) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const activeYear = years?.find((y) => y.isCurrent);
  const campusId   = years?.[0]?.campusId ?? campuses?.[0]?.id ?? "";

  // Sort: active first, then by startDate desc
  const sorted = [...(years ?? [])].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Hero */}
      <div
        className="animate-in fade-in slide-in-from-bottom-4 duration-700 relative overflow-hidden rounded-3xl grad-hero p-6 lg:p-8"
        style={{ animationFillMode: "both" }}
      >
        <div className="noise-bg absolute inset-0 opacity-40" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white/70">Gestion académique</p>
            <h1 className="mt-1 text-3xl font-bold text-white">Années universitaires</h1>
            {activeYear && (
              <p className="mt-2 text-sm text-white/80">
                Année en cours : <span className="font-semibold text-white">{activeYear.label}</span>
              </p>
            )}
          </div>
          {user.systemRole === "SUPER_ADMIN" && (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/30"
            >
              <Plus size={16} /> Nouvelle année
            </button>
          )}
        </div>

        {/* Timeline */}
        {sorted.length > 0 && (
          <div className="relative mt-6 flex items-center gap-3 overflow-x-auto pb-1">
            {sorted.map((y, i) => {
              const st = deriveYearStatus(y);
              return (
                <div key={y.id} className="flex shrink-0 items-center gap-3">
                  {i > 0 && <div className="h-px w-6 bg-white/30" />}
                  <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${y.isCurrent ? "bg-white text-classroom" : "bg-white/15 text-white/80"}`}>
                    {st === "ACTIVE" && <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-classroom opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-classroom" /></span>}
                    {y.label}
                  </div>
                </div>
              );
            })}
            <div className="flex shrink-0 items-center gap-3">
              <div className="h-px w-6 bg-white/30" />
              <div className="flex items-center gap-1.5 rounded-full border border-white/30 border-dashed px-3 py-1.5 text-xs text-white/50">
                <Plus size={10} /> Suivante
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary stats */}
      {activeYear && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Années au total", value: years?.length ?? 0, icon: <Calendar size={18} /> },
            { label: "Semestres actifs", value: activeYear.semesters?.filter(s => s.isActive).length ?? 0, icon: <BookOpen size={18} /> },
            { label: "Promotions", value: activeYear._count?.promotions ?? 0, icon: <GraduationCap size={18} /> },
            { label: "Étudiants inscrits", value: activeYear._studentCount ?? 0, icon: <Users size={18} /> },
          ].map((s, i) => (
            <div
              key={s.label}
              className="animate-in fade-in slide-in-from-bottom-2 duration-400 flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-elegant"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-classroom/10 text-classroom">
                {s.icon}
              </div>
              <div>
                <p className="text-lg font-bold leading-none">{s.value}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Year cards */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Toutes les années</h2>
          <span className="text-sm text-muted-foreground">{sorted.length} année{sorted.length > 1 ? "s" : ""}</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
            <Calendar className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">Aucune année universitaire</p>
            <p className="mt-1 text-sm text-muted-foreground/70">Créez la première année pour commencer.</p>
            {user.systemRole === "SUPER_ADMIN" && (
              <button onClick={() => setCreating(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl grad-classroom px-4 py-2 text-sm font-semibold text-white">
                <Plus size={14} /> Créer une année
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {sorted.map((y, i) => (
              <YearCard key={y.id} year={y} delay={i * 80} />
            ))}
          </div>
        )}
      </div>

      {creating && campusId && (
        <CreateYearDialog campusId={campusId} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}
