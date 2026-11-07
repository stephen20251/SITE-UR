// Progression du cursus d'un enfant, vue par le parent : écolage, cours du mois
// (progression de l'enfant + avancement du syllabus en classe), présences.
import { CheckCircle2, Lock } from "lucide-react";
import { Bar, Card, CourseStatusBadge, Pill, TuitionBadge } from "@/components/classroom/cursus-ui";
import { fmtMGA, useParentCursus } from "@/lib/cursus";

const ATT_LABEL: Record<string, { l: string; cls: string }> = {
  PRESENT: { l: "Présent", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  ABSENT: { l: "Absent", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  LATE: { l: "Retard", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  EXCUSED: { l: "Excusé", cls: "bg-muted text-muted-foreground" },
};

export function ParentCursusSection({ childUserId }: { childUserId?: string | null }) {
  const q = useParentCursus();
  const child = (q.data ?? []).find((c) => c.student.userId === childUserId) ?? q.data?.[0];
  if (!child) return null;
  const { cursus, attendance } = child;
  const shown = cursus.months.filter((m) => m.status !== "UNPAID" || m.canPay);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Progression du cursus — {child.student.user.firstName}</h2>
          <p className="text-sm text-muted-foreground">
            {cursus.student.level} · {cursus.student.mention?.name} · écolage {fmtMGA(cursus.monthlyAmount, cursus.currency)} / mois
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Pill className="bg-muted">{cursus.paidCount}/8 mois payés</Pill>
          <Pill className="bg-muted">{cursus.completedCount}/8 mois terminés</Pill>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {shown.length === 0 && <Card className="text-sm text-muted-foreground">Aucun mois d'écolage réglé pour le moment.</Card>}
          {shown.map((m) => (
            <Card key={m.month}>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Mois {m.month}</h3>
                <TuitionBadge status={m.status} />
                {m.payment?.receiptNumber && <span className="text-xs text-muted-foreground">reçu {m.payment.receiptNumber}</span>}
              </div>
              <div className="mt-3 space-y-3">
                {m.courses.map((c) => (
                  <div key={c.id}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {c.completed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : m.status !== "PAID" ? <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
                        <span className="truncate">{c.title}</span>
                      </span>
                      <CourseStatusBadge status={c.progress.status} />
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-3 text-[11px] text-muted-foreground">
                      <div>Progression de l'enfant · {Math.round(c.myProgress)} %<Bar value={c.myProgress} className="mt-0.5" /></div>
                      <div>Cours en classe · {c.progress.syllabusDone}/{c.progress.syllabusTotal} points, {c.progress.hoursDone}/{c.progress.plannedHours} h<Bar value={c.progress.syllabusPct} className="mt-0.5" /></div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <h3 className="font-semibold">Présences (60 derniers jours)</h3>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
            {(["present", "absent", "late", "excused"] as const).map((k, i) => (
              <div key={k} className="rounded-lg bg-muted/50 p-2">
                <div className="text-lg font-semibold">{attendance[k]}</div>
                <div className="text-muted-foreground">{["Présent", "Absent", "Retard", "Excusé"][i]}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            {attendance.recent.length === 0 && <p className="text-xs text-muted-foreground">Aucun appel enregistré.</p>}
            {attendance.recent.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-xs">
                <span>{new Date(a.date).toLocaleDateString("fr-FR")} · {a.subject?.name ?? "Cours"}</span>
                <Pill className={ATT_LABEL[a.status]?.cls ?? "bg-muted"}>{ATT_LABEL[a.status]?.l ?? a.status}</Pill>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
