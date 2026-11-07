import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, FileText, GraduationCap, ListChecks, UserPlus } from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";
import { Card, Loading, PageHeader } from "@/components/classroom/cursus-ui";
import { useCandidates } from "@/lib/candidatures";
import { useSessionsDay } from "@/lib/cursus";
import { todayStr } from "@/components/classroom/cursus-ui";

export const Route = createFileRoute("/classroom/secretaire")({ component: SecretaireDash });

function SecretaireDash() {
  const { user, roles, ready } = useRequireClassroom(["STAFF"]);
  const cands = useCandidates({});
  const sessions = useSessionsDay(todayStr());

  if (!ready || !user) return <Loading />;
  const list = cands.data?.candidates ?? [];
  const todo = list.filter((c) => c.status === "SUBMITTED" || c.status === "UNDER_REVIEW").length;
  const toEnroll = list.filter((c) => c.status === "ACCEPTED").length;
  const enrolled = list.filter((c) => c.status === "ENROLLED").length;
  const s = sessions.data?.sessions ?? [];
  const done = s.filter((x) => x.log).length;

  const tiles = [
    { label: "Candidatures à traiter", value: todo, to: "/classroom/candidatures", Icon: FileText },
    { label: "Acceptés à inscrire", value: toEnroll, to: "/classroom/candidatures", Icon: UserPlus },
    { label: "Candidats inscrits", value: enrolled, to: "/classroom/inscription", Icon: GraduationCap },
    { label: "Cours accomplis aujourd'hui", value: `${done}/${s.length}`, to: "/classroom/suivi-cours", Icon: ListChecks },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader title={roles[0]?.roleName ?? "Secrétariat"} subtitle="Admissions, inscriptions, présences et suivi des cours." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ label, value, to, Icon }) => (
          <Link key={label} to={to} className="flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-elegant transition hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-classroom/10"><Icon className="h-5 w-5 text-classroom" /></div>
            <div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
          </Link>
        ))}
      </div>
      <Card>
        <h2 className="font-semibold">Raccourcis</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link to="/classroom/candidatures" className="rounded-lg border px-3 py-2 hover:bg-accent">Traiter les candidatures</Link>
          <Link to="/classroom/inscription" className="rounded-lg border px-3 py-2 hover:bg-accent">Inscrire directement un étudiant</Link>
          <Link to="/classroom/appel" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 hover:bg-accent"><ClipboardCheck className="h-4 w-4" /> Faire l'appel</Link>
          <Link to="/classroom/suivi-cours" className="rounded-lg border px-3 py-2 hover:bg-accent">Cocher les cours du jour</Link>
        </div>
      </Card>
    </div>
  );
}
