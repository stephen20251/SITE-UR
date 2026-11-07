import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, Eye, FileText, Loader2, Send, X } from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";
import { Card, Empty, Loading, PageHeader, Pill, btnGhost, btnPrimary } from "@/components/classroom/cursus-ui";
import { api, API_BASE, ApiError } from "@/lib/api";
import { cursusPlace, KIND_LABEL } from "@/lib/cursus";
import type { CourseDetail } from "@/lib/online";

export const Route = createFileRoute("/classroom/validation-cours")({ component: ValidationCours });

type ReviewItem = {
  id: string; title: string; subtitle: string | null; status: string; courseKind: string;
  cursusLevel: string | null; cursusMonth: number | null; mention: string | null; price: number | null;
  submittedAt: string; lessons: number;
  teacher: { firstName: string; lastName: string; email: string };
  category: { name: string } | null;
  _count: { modules: number; quizzes: number };
};

const ORIGIN = new URL(API_BASE).origin;
const media = (u?: string | null) => (!u ? undefined : u.startsWith("http") ? u : `${ORIGIN}${u}`);

function ValidationCours() {
  const { user, ready } = useRequireClassroom(["STAFF", "SUPER_ADMIN"]);
  const q = useQuery({
    queryKey: ["course-reviews"],
    queryFn: () => api<ReviewItem[]>("/cursus/course-reviews"),
    enabled: ready && !!user,
  });
  const [open, setOpen] = useState<ReviewItem | null>(null);

  if (!ready || !user) return <Loading />;
  if (q.isError) return <Empty>Accès réservé aux Responsables de mention et au Super Admin.</Empty>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Validation des cours"
        subtitle="Cours soumis par les enseignants de votre mention : examinez-les, puis validez la publication ou renvoyez-les avec un commentaire."
      />
      {q.isLoading ? <Loading /> : (q.data ?? []).length === 0 ? (
        <Empty>Aucun cours en attente de validation.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {q.data!.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{c.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {c.teacher.firstName} {c.teacher.lastName} · {c.mention ?? "Mention non définie"}
                  </p>
                </div>
                <Pill className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">En validation</Pill>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <Pill className="bg-muted">{KIND_LABEL[c.courseKind] ?? c.courseKind}</Pill>
                {c.cursusLevel && <Pill className="bg-muted">{cursusPlace(c.cursusLevel, c.cursusMonth)}</Pill>}
                {c.category && <Pill className="bg-muted">{c.category.name}</Pill>}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {c._count.modules} module{c._count.modules > 1 ? "s" : ""} · {c.lessons} leçon{c.lessons > 1 ? "s" : ""} · {c._count.quizzes} test{c._count.quizzes > 1 ? "s" : ""}
                {" · "}soumis le {new Date(c.submittedAt).toLocaleDateString("fr-FR")}
              </p>
              <button onClick={() => setOpen(c)} className={`${btnPrimary} mt-4`}><Eye className="h-4 w-4" /> Examiner</button>
            </Card>
          ))}
        </div>
      )}
      {open && <ReviewDialog item={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ReviewDialog({ item, onClose }: { item: ReviewItem; onClose: () => void }) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["course-reviews", item.id],
    queryFn: () => api<CourseDetail>(`/cursus/course-reviews/${item.id}`),
  });
  const [note, setNote] = useState("");
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const decide = useMutation({
    mutationFn: (decision: "publish" | "reject") =>
      api(`/cursus/course-reviews/${item.id}/decision`, { method: "POST", body: { decision, note: note.trim() || undefined } }),
    onSuccess: (_d, decision) => {
      qc.invalidateQueries({ queryKey: ["course-reviews"] });
      toast.success(decision === "publish" ? "Cours validé et publié" : "Cours renvoyé à l'enseignant");
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Échec"),
  });

  const c = detail.data;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="flex h-full w-full max-w-3xl flex-col bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b p-5">
          <div>
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="text-xs text-muted-foreground">{item.teacher.firstName} {item.teacher.lastName} · {item.teacher.email}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {detail.isLoading || !c ? <Loading /> : (
            <>
              {c.subtitle && <p className="font-medium">{c.subtitle}</p>}
              <section>
                <h3 className="text-sm font-semibold">Description</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{c.description || "—"}</p>
              </section>
              {c.objectives.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold">Objectifs</h3>
                  <ul className="mt-1 space-y-1 text-sm">{c.objectives.map((o) => <li key={o} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{o}</li>)}</ul>
                </section>
              )}
              <section>
                <h3 className="text-sm font-semibold">Contenu ({c.modules.length} modules)</h3>
                <div className="mt-2 divide-y rounded-xl border">
                  {c.modules.map((m, i) => (
                    <div key={m.id} className="p-3">
                      <div className="text-sm font-medium">Module {i + 1} · {m.title}</div>
                      <ul className="mt-1.5 space-y-1">
                        {m.lessons.map((l) => (
                          <li key={l.id} className="text-sm">
                            <button onClick={() => setOpenLesson(openLesson === l.id ? null : l.id)} className="flex w-full items-center gap-2 text-left hover:text-classroom">
                              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="flex-1">{l.title}</span>
                              <span className="text-[11px] text-muted-foreground">{l.type}{l.files.length ? ` · ${l.files.length} fichier(s)` : ""}</span>
                              <ChevronDown className={`h-3.5 w-3.5 transition ${openLesson === l.id ? "rotate-180" : ""}`} />
                            </button>
                            {openLesson === l.id && (
                              <div className="mt-2 space-y-2 rounded-lg bg-muted/40 p-3 text-xs">
                                {l.body && <p className="whitespace-pre-line">{l.body}</p>}
                                {l.contentUrl && <a href={media(l.contentUrl)} target="_blank" rel="noreferrer" className="block text-classroom hover:underline">Ouvrir le contenu principal</a>}
                                {l.files.map((f) => (
                                  <a key={f.id} href={media(f.url)} target="_blank" rel="noreferrer" className="block text-classroom hover:underline">📎 {f.name}</a>
                                ))}
                                {!l.body && !l.contentUrl && l.files.length === 0 && <p className="italic text-muted-foreground">Leçon vide.</p>}
                              </div>
                            )}
                          </li>
                        ))}
                        {m.lessons.length === 0 && <li className="text-xs italic text-muted-foreground">Aucune leçon.</li>}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold">Tests ({c.quizzes.length})</h3>
                {c.quizzes.length === 0
                  ? <p className="mt-1 text-sm text-amber-600">Aucun test : le cours ne pourra pas être évalué.</p>
                  : <ul className="mt-1 space-y-1 text-sm">{c.quizzes.map((q) => <li key={q.id}>{q.title} · {q.questionCount} questions · réussite {q.passingScore} %{q.audience && q.audience !== "ALL" ? ` · ${q.audience === "STUDENT" ? "étudiants" : "non-étudiants"}` : ""}</li>)}</ul>}
              </section>
            </>
          )}
        </div>

        <div className="space-y-3 border-t p-5">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            placeholder="Commentaire pour l'enseignant (obligatoire pour renvoyer le cours)"
            className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <div className="flex flex-wrap justify-end gap-2">
            <button disabled={decide.isPending || !note.trim()} onClick={() => decide.mutate("reject")} className={btnGhost}>
              <Send className="h-4 w-4" /> Renvoyer à l'enseignant
            </button>
            <button disabled={decide.isPending} onClick={() => decide.mutate("publish")} className={btnPrimary}>
              {decide.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Valider et publier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
