import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateQuiz, type QuestionType } from "@/lib/online";
import { ApiError } from "@/lib/api";

type OptDraft = { text: string; isCorrect: boolean };
type QDraft = { text: string; type: QuestionType; points: number; options: OptDraft[] };

const blankQuestion = (): QDraft => ({
  text: "",
  type: "MCQ_SINGLE",
  points: 1,
  options: [
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
  ],
});

const input = "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

export function QuizBuilder({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const create = useCreateQuiz(courseId);
  const [title, setTitle] = useState("");
  const [passingScore, setPassingScore] = useState(50);
  const [randomize, setRandomize] = useState(false);
  // Espace test : étudiants du cursus (passer au cours suivant) / non-étudiants (certificat)
  const [audience, setAudience] = useState<"ALL" | "STUDENT" | "PUBLIC">("ALL");
  const [poolSize, setPoolSize] = useState<number | "">("");
  const [questions, setQuestions] = useState<QDraft[]>([blankQuestion()]);

  function patchQ(i: number, patch: Partial<QDraft>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function setType(i: number, type: QuestionType) {
    setQuestions((qs) =>
      qs.map((q, idx) => {
        if (idx !== i) return q;
        if (type === "TRUE_FALSE") {
          return { ...q, type, options: [{ text: "True", isCorrect: true }, { text: "False", isCorrect: false }] };
        }
        // when switching to single, keep only the first correct
        let seen = false;
        const options = q.options.map((o) => {
          if (type === "MCQ_SINGLE" && o.isCorrect) {
            if (seen) return { ...o, isCorrect: false };
            seen = true;
          }
          return o;
        });
        return { ...q, type, options };
      }),
    );
  }
  function patchOpt(qi: number, oi: number, patch: Partial<OptDraft>) {
    setQuestions((qs) =>
      qs.map((q, idx) => (idx === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) } : q)),
    );
  }
  function setCorrect(qi: number, oi: number, multi: boolean) {
    setQuestions((qs) =>
      qs.map((q, idx) => {
        if (idx !== qi) return q;
        const options = q.options.map((o, j) =>
          multi ? (j === oi ? { ...o, isCorrect: !o.isCorrect } : o) : { ...o, isCorrect: j === oi },
        );
        return { ...q, options };
      }),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // light client-side validation mirroring the backend rules
    for (const q of questions) {
      if (!q.text.trim()) return toast.error("Every question needs text");
      if (q.options.some((o) => !o.text.trim())) return toast.error("Every option needs text");
      const correct = q.options.filter((o) => o.isCorrect).length;
      if (correct === 0) return toast.error("Each question needs a correct answer");
      if (q.type !== "MCQ_MULTI" && correct !== 1) return toast.error("Single/True-False questions need exactly one correct answer");
    }
    try {
      await create.mutateAsync({
        title,
        passingScore,
        randomize,
        audience,
        ...(randomize && poolSize ? { poolSize: Number(poolSize) } : {}),
        questions: questions.map((q) => ({
          text: q.text,
          type: q.type,
          points: q.points,
          options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
        })),
      });
      toast.success("Quiz created");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create quiz");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input className={input} placeholder="Quiz title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Pass %
          <input type="number" min={0} max={100} className={`${input} w-20`} value={passingScore}
            onChange={(e) => setPassingScore(Number(e.target.value))} />
        </label>
      </div>

      {/* Public du test */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Test destiné aux :</span>
        {([["ALL", "Tous"], ["STUDENT", "Étudiants (cursus)"], ["PUBLIC", "Non-étudiants (pro)"]] as const).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setAudience(v)}
            className={`rounded-full border px-3 py-1 text-xs transition ${audience === v ? "border-online bg-online/10 text-online" : "hover:bg-accent"}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Question bank / randomization */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed bg-muted/20 px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={randomize} onChange={(e) => setRandomize(e.target.checked)} className="rounded" />
          <span className="font-medium">Banque de questions (tirage aléatoire)</span>
        </label>
        {randomize && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Questions servies par tentative
            <input
              type="number" min={1} max={questions.length}
              className={`${input} w-20`}
              value={poolSize}
              placeholder={String(questions.length)}
              onChange={(e) => setPoolSize(e.target.value === "" ? "" : Number(e.target.value))}
            />
            <span className="text-xs">/ {questions.length} dans la banque</span>
          </label>
        )}
        {randomize && (
          <p className="w-full text-xs text-muted-foreground">
            Chaque étudiant reçoit un sous-ensemble aléatoire différent (ordre des questions et des choix mélangé).
          </p>
        )}
      </div>

      <div className="space-y-4">
        {questions.map((q, qi) => {
          const multi = q.type === "MCQ_MULTI";
          return (
            <div key={qi} className="rounded-xl border p-4">
              <div className="flex items-start gap-2">
                <span className="mt-2 text-sm font-medium text-muted-foreground">{qi + 1}.</span>
                <div className="flex-1 space-y-3">
                  <input className={input} placeholder="Question text" value={q.text}
                    onChange={(e) => patchQ(qi, { text: e.target.value })} required />
                  <div className="flex flex-wrap items-center gap-2">
                    <select className={`${input} w-auto`} value={q.type} onChange={(e) => setType(qi, e.target.value as QuestionType)}>
                      <option value="MCQ_SINGLE">Single choice</option>
                      <option value="MCQ_MULTI">Multiple choice</option>
                      <option value="TRUE_FALSE">True / False</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      pts
                      <input type="number" min={0.5} step={0.5} className={`${input} w-16`} value={q.points}
                        onChange={(e) => patchQ(qi, { points: Number(e.target.value) })} />
                    </label>
                    {questions.length > 1 && (
                      <button type="button" onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== qi))}
                        className="ml-auto inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {q.options.map((o, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input
                          type={multi ? "checkbox" : "radio"}
                          name={`correct-${qi}`}
                          checked={o.isCorrect}
                          onChange={() => setCorrect(qi, oi, multi)}
                          className="accent-[var(--online)]"
                          title="Mark correct"
                        />
                        <input className={input} placeholder={`Option ${oi + 1}`} value={o.text}
                          onChange={(e) => patchOpt(qi, oi, { text: e.target.value })} required />
                        {q.type !== "TRUE_FALSE" && q.options.length > 2 && (
                          <button type="button" onClick={() => patchQ(qi, { options: q.options.filter((_, j) => j !== oi) })}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border hover:bg-accent">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {q.type !== "TRUE_FALSE" && q.options.length < 8 && (
                      <button type="button" onClick={() => patchQ(qi, { options: [...q.options, { text: "", isCorrect: false }] })}
                        className="inline-flex items-center gap-1 text-xs font-medium text-online hover:underline">
                        <Plus className="h-3.5 w-3.5" /> Add option
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setQuestions((qs) => [...qs, blankQuestion()])}
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
          <Plus className="h-4 w-4" /> Add question
        </button>
        <button type="submit" disabled={create.isPending}
          className="inline-flex items-center gap-2 rounded-lg grad-online px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">
          {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Create quiz
        </button>
      </div>
    </form>
  );
}
