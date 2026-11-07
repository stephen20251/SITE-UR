import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Trophy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useQuiz, useSubmitQuiz, type SubmitResult } from "@/lib/online";
import { ApiError } from "@/lib/api";

/**
 * Renders a takeable quiz (no answer keys), grades it via the backend on submit,
 * and shows a per-question breakdown. Used inside a Modal on the course page.
 */
export function QuizRunner({ quizId, courseId }: { quizId: string; courseId: string }) {
  const quiz = useQuiz(quizId);
  const submit = useSubmitQuiz(quizId, courseId);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);

  const breakdownByQ = useMemo(
    () => new Map((result?.breakdown ?? []).map((b) => [b.questionId, b])),
    [result],
  );

  if (quiz.isLoading) {
    return <div className="grid h-40 place-items-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (quiz.isError || !quiz.data) {
    return <p className="text-sm text-destructive">Couldn’t load this quiz.</p>;
  }

  const q = quiz.data;

  function choose(questionId: string, optionId: string, multi: boolean) {
    if (result) return; // locked after grading
    setSelected((prev) => {
      const cur = prev[questionId] ?? [];
      if (multi) {
        return { ...prev, [questionId]: cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId] };
      }
      return { ...prev, [questionId]: [optionId] };
    });
  }

  async function onSubmit() {
    const answers = q.questions.map((question) => ({
      questionId: question.id,
      selectedOptionIds: selected[question.id] ?? [],
    }));
    try {
      const res = await submit.mutateAsync(answers);
      setResult(res);
      if (res.passed) toast.success(`Passed — ${res.percentage}%`);
      else toast.message(`Scored ${res.percentage}% (need ${res.passingScore}%)`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Submission failed");
    }
  }

  const answeredCount = q.questions.filter((question) => (selected[question.id]?.length ?? 0) > 0).length;

  return (
    <div className="space-y-5">
      {q.description && <p className="text-sm text-muted-foreground">{q.description}</p>}

      {result && <ResultBanner result={result} onRetake={() => { setResult(null); setSelected({}); }} />}

      <ol className="space-y-5">
        {q.questions.map((question, i) => {
          const multi = question.type === "MCQ_MULTI";
          const bd = breakdownByQ.get(question.id);
          return (
            <li key={question.id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium">
                  <span className="text-muted-foreground">{i + 1}.</span> {question.text}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{question.points} pt{question.points === 1 ? "" : "s"}</span>
              </div>
              {multi && !result && <div className="mt-1 text-xs text-muted-foreground">Select all that apply</div>}

              <div className="mt-3 space-y-2">
                {question.options.map((opt) => {
                  const chosen = (selected[question.id] ?? []).includes(opt.id);
                  const isCorrect = bd?.correctOptionIds.includes(opt.id);
                  const wasChosen = bd?.selectedOptionIds.includes(opt.id);
                  const stateCls = result
                    ? isCorrect
                      ? "border-success bg-success/10"
                      : wasChosen
                        ? "border-destructive bg-destructive/10"
                        : "border-border"
                    : chosen
                      ? "border-online bg-online/10"
                      : "border-border hover:bg-accent";
                  return (
                    <label key={opt.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${stateCls}`}>
                      <input
                        type={multi ? "checkbox" : "radio"}
                        name={question.id}
                        checked={chosen}
                        onChange={() => choose(question.id, opt.id, multi)}
                        disabled={!!result}
                        className="accent-[var(--online)]"
                      />
                      <span className="flex-1">{opt.text}</span>
                      {result && isCorrect && <CheckCircle2 className="h-4 w-4 text-success" />}
                      {result && wasChosen && !isCorrect && <XCircle className="h-4 w-4 text-destructive" />}
                    </label>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>

      {!result && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{answeredCount}/{q.questions.length} answered</span>
          <button
            onClick={onSubmit}
            disabled={submit.isPending || answeredCount === 0}
            className="inline-flex items-center gap-2 rounded-lg grad-online px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit quiz
          </button>
        </div>
      )}
    </div>
  );
}

function ResultBanner({ result, onRetake }: { result: SubmitResult; onRetake: () => void }) {
  return (
    <div className={`flex items-center gap-4 rounded-xl border p-4 ${result.passed ? "border-success bg-success/10" : "border-warning bg-warning/10"}`}>
      <div className={`grid h-12 w-12 place-items-center rounded-full ${result.passed ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}`}>
        <Trophy className="h-6 w-6" />
      </div>
      <div className="flex-1">
        <div className="font-semibold">{result.passed ? "Passed!" : "Keep practicing"}</div>
        <div className="text-sm text-muted-foreground">
          Score {result.score}/{result.maxScore} · {result.percentage}% (pass mark {result.passingScore}%)
        </div>
      </div>
      <button onClick={onRetake} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
        <RotateCcw className="h-4 w-4" /> Retake
      </button>
    </div>
  );
}
