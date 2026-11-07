// Cursus universitaire côté en ligne : accessibilité de chaque cours selon le
// visiteur, affichage mois par mois, et progression de l'étudiant de l'UR.
import { Link } from "@tanstack/react-router";
import { CheckCircle2, GraduationCap, Lock, PlayCircle, Wallet } from "lucide-react";
import type { CourseCard } from "@/lib/online";
import { useAuth } from "@/lib/auth";
import {
  fmtMGA, semesterLabel, semesterOf, useMyCursus, type CursusOverview,
} from "@/lib/cursus";
import { MoocCard, type CardStatus } from "@/components/online/mooc-card";

// Lien vers le formulaire de candidature (espace université).
export const CANDIDATE_URL = "/classroom?candidater=1";

// État d'accès d'un cours du cursus pour la personne connectée (ou un visiteur).
export function useCursusAccess() {
  const { user } = useAuth();
  const isStudent = user?.systemRole === "STUDENT";
  const me = useMyCursus(isStudent);
  const byCourse = new Map<string, { month: number; paid: boolean; progress: number; completed: boolean }>();
  for (const m of me.data?.months ?? []) {
    for (const c of m.courses) {
      byCourse.set(c.id, { month: m.month, paid: m.status === "PAID", progress: c.myProgress, completed: c.completed });
    }
  }
  function statusOf(c: Pick<CourseCard, "id" | "courseKind">): CardStatus | undefined {
    if (c.courseKind !== "UNIVERSITY" && c.courseKind !== "BOTH") return undefined;
    // Non-étudiant : le cursus est seulement consultable (étiquette « Cursus UR »).
    if (!isStudent) {
      return c.courseKind === "UNIVERSITY" ? { label: "Réservé aux étudiants UR", locked: true, tag: "CURSUS" } : undefined;
    }
    // Étudiant : étiquette « Accessible » / « Non accessible ».
    const s = byCourse.get(c.id);
    if (!s) return c.courseKind === "UNIVERSITY" ? { label: "Non accessible · autre niveau", locked: true, tag: "LOCKED" } : undefined;
    if (!s.paid) return { label: `Non accessible · mois ${s.month} non payé`, locked: true, tag: "LOCKED" };
    if (s.completed) return { label: "Terminé", done: true, tag: "ACCESSIBLE" };
    return { label: s.progress > 0 ? `En cours · ${Math.round(s.progress)} %` : "Accessible", progress: s.progress, tag: "ACCESSIBLE" };
  }
  return { isStudent, overview: me.data, statusOf };
}

// Catalogue du cursus regroupé par niveau → semestre → mois.
export function CursusMonthsCatalog({ courses, statusOf }: {
  courses: CourseCard[];
  statusOf: (c: CourseCard) => CardStatus | undefined;
}) {
  const levels = [...new Set(courses.map((c) => c.cursusLevel ?? "—"))];
  return (
    <div className="space-y-10">
      {levels.map((level) => {
        const ofLevel = courses.filter((c) => (c.cursusLevel ?? "—") === level);
        const months = [...new Set(ofLevel.map((c) => c.cursusMonth ?? 0))].sort((a, b) => a - b);
        return (
          <div key={level}>
            {levels.length > 1 && <h3 className="mb-4 text-lg font-bold">{level}</h3>}
            <div className="space-y-8">
              {months.map((month) => (
                <div key={month}>
                  <div className="mb-3 flex items-baseline gap-2">
                    <span className="text-base font-semibold">Mois {month}</span>
                    <span className="rounded-full bg-online/10 px-2 py-0.5 text-xs font-semibold text-online">
                      {level !== "—" ? semesterLabel(level, semesterOf(month || 1)) : ""}
                    </span>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {ofLevel.filter((c) => (c.cursusMonth ?? 0) === month).map((c) => (
                      <MoocCard key={c.id} c={c} status={statusOf(c)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Progression de l'étudiant de l'UR dans son cursus (tableau de bord en ligne).
export function MyCursusBoard({ overview }: { overview: CursusOverview }) {
  const level = overview.student.level;
  return (
    <section className="rounded-2xl border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-online">
            <GraduationCap className="h-4 w-4" /> Mon cursus universitaire
          </div>
          <h2 className="mt-1 text-xl font-bold">{level} · {overview.student.mention?.name ?? ""}</h2>
          <p className="text-sm text-muted-foreground">
            {overview.paidCount}/8 mois payés · {overview.completedCount}/8 mois terminés · écolage {fmtMGA(overview.monthlyAmount, overview.currency)} / mois
          </p>
        </div>
        <Link to="/classroom/cursus" className="inline-flex items-center gap-2 rounded-lg bg-online px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          <Wallet className="h-4 w-4" /> Payer l'écolage
        </Link>
      </div>

      {[1, 2].map((sem) => (
        <div key={sem} className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{semesterLabel(level, sem)}</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {overview.months.filter((m) => m.semester === sem).map((m) => {
              const paid = m.status === "PAID";
              return (
                <div key={m.month} className={`rounded-xl border p-4 ${paid ? "" : "bg-muted/30"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Mois {m.month}</span>
                    {paid
                      ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Payé</span>
                      : <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"><Lock className="h-3 w-3" /> Non accessible</span>}
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {m.courses.length === 0 && <p className="text-xs italic text-muted-foreground">Cours pas encore publiés.</p>}
                    {m.courses.map((c) => (
                      <div key={c.id}>
                        {paid ? (
                          <Link to="/online/course/$id" params={{ id: c.id }} className="flex items-center gap-1.5 text-sm hover:text-online hover:underline">
                            {c.completed ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <PlayCircle className="h-3.5 w-3.5 shrink-0 text-online" />}
                            <span className="truncate">{c.title}</span>
                          </Link>
                        ) : (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Lock className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{c.title}</span>
                          </div>
                        )}
                        {paid && (
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className={`h-full ${c.completed ? "bg-emerald-500" : "bg-online"}`} style={{ width: `${Math.round(c.myProgress)}%` }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {!paid && m.status === "PENDING" && <p className="mt-2 text-[11px] text-amber-600">Paiement en cours de validation</p>}
                  {!paid && m.status !== "PENDING" && m.lockReason && <p className="mt-2 text-[11px] text-muted-foreground">{m.lockReason}</p>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

// Bandeau pour les non-étudiants : accès au cursus = candidater à l'UR.
export function BecomeStudentBanner() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-online/30 bg-online/5 p-4 text-sm">
      <span>
        <b>Le cursus universitaire est réservé aux étudiants de l'UR.</b> Vous pouvez consulter les programmes ;
        pour suivre les cours, déposez votre candidature.
      </span>
      <a href={CANDIDATE_URL} className="rounded-lg bg-online px-4 py-2 font-semibold text-white hover:opacity-90">Devenir étudiant(e)</a>
    </div>
  );
}
