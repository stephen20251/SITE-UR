import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, BookOpen, CalendarCheck, Loader2, TrendingUp, Wallet } from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";
import { useMyChildren, useChildGrades, useChildAttendance, type ChildUser } from "@/lib/classroom";
import { useNotifications, useMarkNotificationRead } from "@/lib/notifications";
import { ParentCursusSection } from "@/components/classroom/parent-cursus";
import { tuitionSummary } from "@/components/classroom/tuition";
import { Card } from "@/components/classroom/cursus-ui";
import { fmtMGA, useParentCursus } from "@/lib/cursus";

export const Route = createFileRoute("/classroom/parent")({ component: ParentDash });

// Tableau de bord parent : suivi de l'écolage, des présences, du déroulement des
// cours et des performances de l'enfant sélectionné.
function ParentDash() {
  const { user, ready } = useRequireClassroom(["PARENT"]);
  const enabled = ready && !!user;

  const children = useMyChildren({ enabled });
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const childId = selectedChild ?? (children.data?.[0]?.id ?? null);
  const childGrades = useChildGrades(childId, { enabled: !!childId });
  const childAttendance = useChildAttendance(childId, { enabled: !!childId });
  const cursus = useParentCursus(enabled);
  const notifications = useNotifications(enabled);
  const markRead = useMarkNotificationRead();

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const child = (children.data ?? []).find((c) => c.id === childId) ?? children.data?.[0];
  const childCursus = (cursus.data ?? []).find((c) => c.student.userId === child?.id);
  const tuition = childCursus ? tuitionSummary(childCursus.cursus) : null;

  // Présences
  const attendance = childAttendance.data ?? [];
  const presentCount = attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
  const presentRate = attendance.length ? Math.round((presentCount / attendance.length) * 100) : null;

  // Performances : moyenne /20 par matière
  const grades = childGrades.data ?? [];
  const bySubject = Object.values(grades.reduce<Record<string, { name: string; sum: number; coef: number }>>((acc, g) => {
    const k = g.subjectId;
    acc[k] ??= { name: g.subject?.name ?? "—", sum: 0, coef: 0 };
    acc[k].sum += (g.value / g.maxValue) * 20 * g.coefficient;
    acc[k].coef += g.coefficient;
    return acc;
  }, {})).map((s) => ({ name: s.name, avg: s.coef ? s.sum / s.coef : 0 })).sort((a, b) => a.name.localeCompare(b.name));
  const overall = bySubject.length ? bySubject.reduce((s, x) => s + x.avg, 0) / bySubject.length : null;

  const notifs = (notifications.data?.items ?? []).slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Bonjour, {user.firstName}</h1>
          <p className="text-muted-foreground">Suivi de la scolarité {child ? `de ${child.firstName}` : "de vos enfants"}.</p>
        </div>

        {children.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {(children.data ?? []).map((c: ChildUser) => (
              <button key={c.id} onClick={() => setSelectedChild(c.id)}
                className={`flex items-center gap-2 rounded-xl border p-2 pr-3 text-sm transition ${child?.id === c.id ? "border-classroom bg-classroom/10" : "hover:bg-accent"}`}>
                <div className="grid h-8 w-8 place-items-center rounded-full grad-classroom text-sm font-semibold text-white">{c.firstName[0]}</div>
                <div className="text-left">
                  <div className="font-medium">{c.firstName} {c.lastName}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.studentProfile?.promotion?.name ?? "—"}{c.studentProfile?.mention ? ` · ${c.studentProfile.mention.name}` : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {!child && !children.isLoading && (
        <Card className="text-sm text-muted-foreground">Aucun enfant n'est rattaché à votre compte. Contactez le secrétariat.</Card>
      )}

      {child && (
        <>
          {/* Indicateurs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link to="/classroom/finance" className="block">
              <Card className="h-full transition hover:shadow-lg">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-4 w-4" /> Écolage</div>
                <div className="mt-1 text-2xl font-semibold">{tuition ? `${tuition.paid}/${tuition.total}` : "—"} <span className="text-sm font-normal text-muted-foreground">mois payés</span></div>
                {tuition && (
                  <div className={`text-xs ${tuition.semDueCount ? "text-amber-600" : "text-emerald-600"}`}>
                    {tuition.semDueCount ? `Reste ${fmtMGA(tuition.semDueAmount, childCursus?.cursus.currency)} ce semestre` : "Semestre à jour"}
                  </div>
                )}
              </Card>
            </Link>
            <Card>
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarCheck className="h-4 w-4" /> Présence</div>
              <div className="mt-1 text-2xl font-semibold">{presentRate !== null ? `${presentRate} %` : "—"}</div>
              <div className="text-xs text-muted-foreground">{attendance.length} séance(s) enregistrée(s)</div>
            </Card>
            <Card>
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><BookOpen className="h-4 w-4" /> Cours</div>
              <div className="mt-1 text-2xl font-semibold">{childCursus ? `${childCursus.cursus.completedCount}/8` : "—"} <span className="text-sm font-normal text-muted-foreground">mois terminés</span></div>
              <div className="text-xs text-muted-foreground">{childCursus?.cursus.student.level ?? ""} {childCursus?.cursus.student.mention?.name ?? ""}</div>
            </Card>
            <Card>
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-4 w-4" /> Performance</div>
              <div className={`mt-1 text-2xl font-semibold ${overall !== null && overall < 10 ? "text-red-600" : ""}`}>{overall !== null ? `${overall.toFixed(2)} / 20` : "—"}</div>
              <div className="text-xs text-muted-foreground">moyenne des matières notées</div>
            </Card>
          </div>

          {/* Déroulement des cours + présences détaillées */}
          <ParentCursusSection childUserId={child.id} />

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Performances par matière */}
            <Card>
              <h3 className="font-semibold">Performances — {child.firstName}</h3>
              {childGrades.isLoading ? (
                <div className="mt-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : bySubject.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Aucune note pour le moment.</p>
              ) : (
                <div className="mt-4 space-y-3 text-sm">
                  {bySubject.map((s) => (
                    <div key={s.name}>
                      <div className="flex items-center justify-between">
                        <span>{s.name}</span>
                        <span className={`font-semibold ${s.avg < 10 ? "text-red-600" : ""}`}>{s.avg.toFixed(2)} / 20</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full ${s.avg < 10 ? "bg-red-500" : "grad-classroom"}`} style={{ width: `${Math.min(100, (s.avg / 20) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Notifications concernant l'enfant */}
            <Card>
              <h3 className="font-semibold">Notifications</h3>
              {notifs.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Aucune notification.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {notifs.map((n) => (
                    <li key={n.id} onClick={() => !n.readAt && markRead.mutate(n.id)}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${!n.readAt ? "bg-muted/30" : ""}`}>
                      <Bell className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="line-clamp-1 font-medium">{n.title}</div>
                        {n.body && <div className="line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
                      </div>
                      {!n.readAt && <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-classroom" />}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
