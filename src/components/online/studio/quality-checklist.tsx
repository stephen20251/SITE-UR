import { Check, X, ArrowRight } from "lucide-react";
import type { CourseDetail } from "@/lib/online";

type Check_ = { label: string; done: boolean; tab?: string; hint?: string };

export function QualityChecklist({
  course,
  onGoToTab,
}: {
  course: CourseDetail;
  onGoToTab?: (tab: string) => void;
}) {
  const mods = course.modules ?? [];
  const checks: Check_[] = [
    { label: "Titre renseigné",           done: (course.title ?? "").length >= 3,                    tab: "info" },
    { label: "Description complète",      done: (course.description ?? "").length > 50,              tab: "info", hint: "Min. 50 caractères" },
    { label: "Image de couverture",       done: !!course.thumbnail,                                  tab: "cover" },
    { label: "Au moins 1 module",         done: mods.length > 0,                                     tab: "modules" },
    { label: "Au moins 1 leçon",          done: mods.some(m => (m.lessons ?? []).length > 0),        tab: "modules" },
    { label: "Catégorie définie",         done: !!course.category,                                   tab: "info" },
    { label: "Niveau défini",             done: !!course.level,                                      tab: "info" },
    { label: "Langue définie",            done: !!course.language,                                   tab: "info" },
    { label: "Durée estimée",             done: !!course.estimatedHours,                             tab: "settings" },
    { label: "Objectifs pédagogiques",    done: (course.objectives ?? []).length > 0,                tab: "info", hint: "Au moins 1 objectif" },
    { label: "Leçon avec fichier",        done: mods.some(m => (m.lessons ?? []).some(l => l.contentUrl)), tab: "modules" },
    { label: "Quiz ou devoir",            done: (course.quizzes ?? []).length > 0,                   tab: "quiz" },
  ];

  const done = checks.filter(c => c.done).length;
  const pct = Math.round((done / checks.length) * 100);
  const color = pct === 100 ? "text-green-600" : pct >= 70 ? "text-yellow-600" : "text-destructive";
  const barColor = pct === 100 ? "bg-green-500" : pct >= 70 ? "bg-yellow-500" : "bg-destructive";

  return (
    <div className="space-y-4">
      {/* Score */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">Qualité du cours</span>
          <span className={`text-2xl font-bold ${color}`}>{pct}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{done} / {checks.length} critères validés</p>
      </div>

      {/* Checklist */}
      <div className="rounded-xl border bg-card divide-y overflow-hidden">
        {checks.map(({ label, done: ok, tab, hint }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3">
            <div className={`shrink-0 rounded-full p-1 ${ok ? "bg-green-500/10" : "bg-destructive/10"}`}>
              {ok
                ? <Check className="h-3.5 w-3.5 text-green-600" />
                : <X className="h-3.5 w-3.5 text-destructive" />}
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-sm ${ok ? "" : "text-muted-foreground"}`}>{label}</span>
              {hint && !ok && <span className="ml-2 text-xs text-muted-foreground">({hint})</span>}
            </div>
            {!ok && tab && onGoToTab && (
              <button onClick={() => onGoToTab(tab)}
                className="flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs text-online hover:bg-online/5">
                Compléter <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
