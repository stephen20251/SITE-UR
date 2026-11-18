import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, X, ExternalLink } from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";
import { Card, Empty, Loading, PageHeader } from "@/components/classroom/cursus-ui";
import { QuizEditor } from "@/components/online/quiz-editor";
import { useAllQuizzes, type QuizAdminItem } from "@/lib/online";

export const Route = createFileRoute("/classroom/qcm")({ component: QcmPage });

const AUDIENCE: Record<string, string> = { ALL: "Tous", STUDENT: "Étudiants du cursus", PUBLIC: "Hors cursus" };

// Super Admin : tous les QCM de la plateforme. On les consulte, on corrige les
// questions et les bonnes réponses, on en ajoute — sans perdre les résultats.
function QcmPage() {
  const { user, ready } = useRequireClassroom(["SUPER_ADMIN"]);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const list = useAllQuizzes(search);
  const [open, setOpen] = useState<QuizAdminItem | null>(null);

  if (!ready || !user) return <Loading />;
  const items = list.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="QCM" subtitle="Tous les QCM de la plateforme : modifiez les questions, les réponses et les bonnes réponses, ou ajoutez des questions. Les résultats des étudiants sont conservés." />
      <form onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }} className="flex max-w-md items-center gap-2 rounded-xl border bg-card px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un QCM ou un cours…" className="h-10 flex-1 bg-transparent text-sm outline-none" />
      </form>
      {list.isLoading ? <Loading /> : items.length === 0 ? <Empty>Aucun QCM.</Empty> : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">QCM</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Cours</th>
                  <th className="px-4 py-3 text-center font-medium">Questions</th>
                  <th className="hidden px-4 py-3 text-center font-medium sm:table-cell">Tentatives</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Modifié le</th>
                </tr>
              </thead>
              <tbody>
                {items.map((x) => (
                  <tr key={x.id} onClick={() => setOpen(x)} className="cursor-pointer border-b last:border-0 hover:bg-muted/30" title="Modifier ce QCM">
                    <td className="px-4 py-3">
                      <div className="font-medium">{x.title}</div>
                      <div className="text-xs text-muted-foreground">réussite {x.passingScore} %{x.timeLimit ? ` · ${x.timeLimit} min` : ""} · {AUDIENCE[x.audience] ?? x.audience}</div>
                      <div className="text-xs text-muted-foreground md:hidden">{x.course?.title}</div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <div>{x.course?.title ?? "—"}</div>
                      {x.course?.teacher && <div className="text-xs text-muted-foreground">{x.course.teacher.firstName} {x.course.teacher.lastName}</div>}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">{x.questionCount}</td>
                    <td className="hidden px-4 py-3 text-center tabular-nums sm:table-cell">{x.attemptCount}</td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">{new Date(x.updatedAt).toLocaleDateString("fr-FR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setOpen(null)}>
          <div className="my-6 w-full max-w-3xl rounded-2xl border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate font-semibold">{open.title}</h2>
                <p className="truncate text-xs text-muted-foreground">{open.course?.title} · {open.attemptCount} tentative{open.attemptCount > 1 ? "s" : ""} conservée{open.attemptCount > 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center gap-1">
                {open.course && (
                  <Link to="/online/course/$id" params={{ id: open.course.id }} className="rounded-lg p-2 hover:bg-accent" title="Voir le cours"><ExternalLink className="h-4 w-4" /></Link>
                )}
                <button onClick={() => setOpen(null)} className="rounded-lg p-2 hover:bg-accent" title="Fermer"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="p-5"><QuizEditor quizId={open.id} courseId={open.course?.id} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
