import { createFileRoute } from "@tanstack/react-router";
import { Loader2, CalendarDays } from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";
import { useMyAttendance } from "@/lib/classroom";

export const Route = createFileRoute("/classroom/presences")({ component: PresencesPage });

const STATUS_LABELS: Record<string, string> = {
  PRESENT: "Présent",
  ABSENT: "Absent",
  LATE: "En retard",
  EXCUSED: "Excusé",
};

const STATUS_CLASSES: Record<string, string> = {
  PRESENT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  ABSENT: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  LATE: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  EXCUSED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

const DOT_CLASSES: Record<string, string> = {
  PRESENT: "bg-emerald-500",
  ABSENT: "bg-red-500",
  LATE: "bg-amber-500",
  EXCUSED: "bg-blue-500",
};

function PresencesPage() {
  const { user, ready } = useRequireClassroom(["STUDENT"]);
  const enabled = ready && !!user;

  const attendance = useMyAttendance({ enabled });

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const records = attendance.data ?? [];
  const total = records.length;
  const present = records.filter((r) => r.status === "PRESENT").length;
  const late = records.filter((r) => r.status === "LATE").length;
  const absent = records.filter((r) => r.status === "ABSENT").length;
  const excused = records.filter((r) => r.status === "EXCUSED").length;
  const presentRate = total ? Math.round(((present + late) / total) * 100) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Mes présences</h1>
        <p className="text-muted-foreground">Historique d'assiduité</p>
      </div>

      {presentRate !== null && (
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Taux de présence", value: `${presentRate}%`, cls: "text-emerald-600 dark:text-emerald-400" },
            { label: "Présent", value: String(present), cls: "text-emerald-600" },
            { label: "Absent", value: String(absent), cls: "text-red-600" },
            { label: "En retard / Excusé", value: `${late + excused}`, cls: "text-amber-600" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border bg-card p-5 shadow-elegant">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</p>
              <p className={`mt-1 text-3xl font-bold ${stat.cls}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {attendance.isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : records.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-16 text-center text-muted-foreground">
          <CalendarDays className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="font-medium">Aucun enregistrement</p>
          <p className="text-sm">Les présences apparaîtront ici une fois saisies.</p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card shadow-elegant overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-left">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {r.date ? new Date(r.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[r.status] ?? "bg-muted text-muted-foreground"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[r.status] ?? "bg-muted-foreground"}`} />
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {total > 0 && (
        <div className="flex gap-3 text-xs text-muted-foreground">
          {Object.entries(DOT_CLASSES).map(([key, cls]) => (
            <span key={key} className="inline-flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${cls}`} />
              {STATUS_LABELS[key]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
