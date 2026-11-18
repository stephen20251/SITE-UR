import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2, XCircle, Loader2, Trophy, RotateCcw, ChevronLeft, ChevronRight, Clock, Send, ListChecks, Play, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useQuiz, useSubmitQuiz, type SubmitResult } from "@/lib/online";
import { ApiError } from "@/lib/api";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/**
 * Passage d'un quiz : écran d'accueil, une question à la fois (barre de progression,
 * navigation, chronomètre si le quiz est limité dans le temps), récapitulatif avant
 * l'envoi, puis résultat et correction question par question.
 */
export function QuizRunner({ quizId, courseId }: { quizId: string; courseId: string }) {
  const quiz = useQuiz(quizId);
  const submit = useSubmitQuiz(quizId, courseId);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [reviewing, setReviewing] = useState(false); // récapitulatif avant envoi
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const submittedRef = useRef(false);

  const q = quiz.data;
  const questions = q?.questions ?? [];
  const current = questions[index];
  const answered = (id: string) => (selected[id]?.length ?? 0) > 0;
  const answeredCount = questions.filter((x) => answered(x.id)).length;
  const breakdownByQ = useMemo(() => new Map((result?.breakdown ?? []).map((b) => [b.questionId, b])), [result]);

  const doSubmit = useCallback(async (auto = false) => {
    if (!q || submittedRef.current) return;
    submittedRef.current = true;
    try {
      const res = await submit.mutateAsync(q.questions.map((x) => ({ questionId: x.id, selectedOptionIds: selected[x.id] ?? [] })));
      setResult(res);
      setReviewing(false);
      if (auto) toast.message("Temps écoulé : vos réponses ont été envoyées.");
      if (res.passed) toast.success(`Quiz réussi — ${Math.round(res.percentage)} %`);
    } catch (err) {
      submittedRef.current = false;
      toast.error(err instanceof ApiError ? err.message : "L'envoi du quiz a échoué, réessayez.");
    }
  }, [q, selected, submit]);

  // Chronomètre (quiz limité dans le temps)
  useEffect(() => {
    if (!started || result || !q?.timeLimit) return;
    if (secondsLeft === null) { setSecondsLeft(q.timeLimit * 60); return; }
    if (secondsLeft <= 0) { doSubmit(true); return; }
    const t = setTimeout(() => setSecondsLeft((s) => (s ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [started, result, q?.timeLimit, secondsLeft, doSubmit]);

  // Clavier : 1-8 / A-H pour répondre, flèches pour naviguer
  useEffect(() => {
    if (!started || result || reviewing || !current) return;
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      const n = Number(e.key);
      const letter = LETTERS.indexOf(e.key.toUpperCase());
      const i = n >= 1 && n <= 8 ? n - 1 : letter;
      if (i >= 0 && current.options[i]) { e.preventDefault(); choose(current.id, current.options[i].id, current.type === "MCQ_MULTI"); }
      if (e.key === "ArrowRight") setIndex((x) => Math.min(x + 1, questions.length - 1));
      if (e.key === "ArrowLeft") setIndex((x) => Math.max(x - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (quiz.isLoading) {
    return <div className="grid h-48 place-items-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (quiz.isError || !q) {
    const msg = quiz.error instanceof ApiError ? quiz.error.message : "Impossible de charger ce quiz.";
    return <p className="flex items-center gap-2 rounded-xl bg-destructive/10 p-4 text-sm text-destructive"><AlertTriangle className="h-4 w-4" /> {msg}</p>;
  }

  function choose(questionId: string, optionId: string, multi: boolean) {
    if (result) return;
    setSelected((prev) => {
      const cur = prev[questionId] ?? [];
      if (multi) return { ...prev, [questionId]: cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId] };
      return { ...prev, [questionId]: [optionId] };
    });
  }

  function restart() {
    submittedRef.current = false;
    setResult(null); setSelected({}); setIndex(0); setReviewing(false); setShowCorrection(false);
    setSecondsLeft(null); setStarted(true);
    quiz.refetch();
  }

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // ── Accueil ──────────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl grad-online text-white shadow-lg"><ListChecks className="h-8 w-8" /></div>
        {q.description && <p className="mx-auto max-w-md text-sm text-muted-foreground">{q.description}</p>}
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2 text-sm">
          <div className="rounded-xl border p-3"><div className="text-lg font-bold">{questions.length}</div><div className="text-xs text-muted-foreground">question{questions.length > 1 ? "s" : ""}</div></div>
          <div className="rounded-xl border p-3"><div className="text-lg font-bold">{q.passingScore} %</div><div className="text-xs text-muted-foreground">pour réussir</div></div>
          <div className="rounded-xl border p-3"><div className="text-lg font-bold">{q.timeLimit ? `${q.timeLimit} min` : "—"}</div><div className="text-xs text-muted-foreground">{q.timeLimit ? "chronométré" : "sans limite"}</div></div>
        </div>
        <p className="text-xs text-muted-foreground">Une question à la fois · vous pouvez revenir en arrière avant d'envoyer · raccourcis : touches 1-4 et flèches</p>
        <button onClick={() => setStarted(true)} disabled={questions.length === 0}
          className="inline-flex items-center gap-2 rounded-xl grad-online px-6 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50">
          <Play className="h-4 w-4" /> Commencer le quiz
        </button>
      </div>
    );
  }

  // ── Résultat ─────────────────────────────────────────────────────────────
  if (result) {
    const pct = Math.round(result.percentage);
    const correct = result.breakdown.filter((b) => b.correct).length;
    return (
      <div className="space-y-5">
        <div className={`flex flex-col items-center gap-3 rounded-2xl border p-6 text-center sm:flex-row sm:text-left ${result.passed ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"}`}>
          <ScoreRing value={pct} passed={result.passed} />
          <div className="flex-1">
            <div className="flex items-center justify-center gap-2 text-lg font-bold sm:justify-start">
              {result.passed ? <><Trophy className="h-5 w-5 text-success" /> Quiz réussi !</> : "Pas encore réussi"}
            </div>
            <p className="text-sm text-muted-foreground">
              {correct} bonne{correct > 1 ? "s" : ""} réponse{correct > 1 ? "s" : ""} sur {result.breakdown.length} · {result.score} / {result.maxScore} points · seuil {result.passingScore} %
            </p>
            {!result.passed && <p className="mt-1 text-xs text-muted-foreground">Relisez les leçons concernées puis retentez : seul votre meilleur résultat compte.</p>}
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => setShowCorrection((v) => !v)} className="rounded-lg border px-3 py-2 text-sm hover:bg-accent">
              {showCorrection ? "Masquer la correction" : "Voir la correction"}
            </button>
            <button onClick={restart} className="inline-flex items-center justify-center gap-2 rounded-lg grad-online px-3 py-2 text-sm font-medium text-white">
              <RotateCcw className="h-4 w-4" /> Recommencer
            </button>
          </div>
        </div>
        {showCorrection && (
          <ol className="space-y-3">
            {questions.map((question, i) => {
              const bd = breakdownByQ.get(question.id);
              if (!bd) return null;
              return (
                <li key={question.id} className={`rounded-xl border p-4 ${bd.correct ? "border-success/40" : "border-destructive/40"}`}>
                  <div className="flex items-start gap-2 font-medium">
                    {bd.correct ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                    <span><span className="text-muted-foreground">{i + 1}.</span> {question.text}</span>
                  </div>
                  <div className="mt-2 space-y-1.5 pl-6">
                    {question.options.map((opt, j) => {
                      const ok = bd.correctOptionIds.includes(opt.id);
                      const mine = bd.selectedOptionIds.includes(opt.id);
                      return (
                        <div key={opt.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${ok ? "bg-success/10" : mine ? "bg-destructive/10" : ""}`}>
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] font-bold text-muted-foreground ring-1 ring-border">{LETTERS[j]}</span>
                          <span className="flex-1">{opt.text}</span>
                          {ok && <span className="text-[11px] font-semibold text-success">bonne réponse</span>}
                          {mine && !ok && <span className="text-[11px] font-semibold text-destructive">votre choix</span>}
                        </div>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    );
  }

  // ── Récapitulatif avant envoi ────────────────────────────────────────────
  if (reviewing) {
    const missing = questions.length - answeredCount;
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-lg font-semibold">Prêt à envoyer ?</div>
          <p className="text-sm text-muted-foreground">
            {answeredCount} / {questions.length} questions répondues{missing ? ` — ${missing} sans réponse (comptées fausses)` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {questions.map((x, i) => (
            <button key={x.id} onClick={() => { setIndex(i); setReviewing(false); }}
              className={`grid h-9 w-9 place-items-center rounded-lg text-sm font-semibold ${answered(x.id) ? "grad-online text-white" : "border border-dashed border-amber-400 text-amber-600"}`}
              title={answered(x.id) ? "Répondue" : "Sans réponse"}>
              {i + 1}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button onClick={() => setReviewing(false)} className="rounded-xl border px-4 py-2.5 text-sm hover:bg-accent">Revenir aux questions</button>
          <button onClick={() => doSubmit()} disabled={submit.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl grad-online px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer mes réponses
          </button>
        </div>
      </div>
    );
  }

  // ── Question en cours ────────────────────────────────────────────────────
  const multi = current?.type === "MCQ_MULTI";
  const isLast = index === questions.length - 1;
  return (
    <div className="space-y-4">
      {/* Progression + chronomètre */}
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">Question {index + 1} / {questions.length}</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full grad-online transition-all" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
        </div>
        {secondsLeft !== null && (
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${secondsLeft < 60 ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>
            <Clock className="h-3.5 w-3.5" /> {fmtTime(secondsLeft)}
          </span>
        )}
      </div>

      {/* Navigation rapide */}
      <div className="flex flex-wrap gap-1.5">
        {questions.map((x, i) => (
          <button key={x.id} onClick={() => setIndex(i)} aria-label={`Question ${i + 1}`}
            className={`h-2.5 w-6 rounded-full transition ${i === index ? "bg-online" : answered(x.id) ? "bg-online/40" : "bg-muted hover:bg-muted-foreground/30"}`} />
        ))}
      </div>

      {current && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold leading-snug">{current.text}</h3>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{current.points} pt{current.points > 1 ? "s" : ""}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{multi ? "Plusieurs réponses possibles" : current.type === "TRUE_FALSE" ? "Vrai ou faux" : "Une seule réponse"}</p>
          <div className="mt-4 grid gap-2">
            {current.options.map((opt, j) => {
              const chosen = (selected[current.id] ?? []).includes(opt.id);
              return (
                <button key={opt.id} type="button" onClick={() => choose(current.id, opt.id, multi)}
                  className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm transition ${chosen ? "border-online bg-online/10 shadow-sm" : "border-border hover:border-online/40 hover:bg-accent"}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${chosen ? "grad-online text-white" : "bg-muted text-muted-foreground"}`}>{LETTERS[j]}</span>
                  <span className="flex-1">{opt.text}</span>
                  {chosen && <CheckCircle2 className="h-4 w-4 text-online" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setIndex((x) => Math.max(0, x - 1))} disabled={index === 0}
          className="inline-flex items-center gap-1 rounded-xl border px-4 py-2.5 text-sm hover:bg-accent disabled:opacity-40">
          <ChevronLeft className="h-4 w-4" /> Précédente
        </button>
        <span className="hidden text-xs text-muted-foreground sm:block">{answeredCount}/{questions.length} répondues</span>
        {isLast ? (
          <button onClick={() => setReviewing(true)} className="inline-flex items-center gap-2 rounded-xl grad-online px-5 py-2.5 text-sm font-semibold text-white">
            Terminer <Send className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={() => setIndex((x) => Math.min(questions.length - 1, x + 1))}
            className="inline-flex items-center gap-1 rounded-xl grad-online px-5 py-2.5 text-sm font-semibold text-white">
            Suivante <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function ScoreRing({ value, passed }: { value: number; passed: boolean }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" className="stroke-muted" />
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
          className={passed ? "stroke-[var(--success,#16a34a)]" : "stroke-amber-500"}
          strokeDasharray={c} strokeDashoffset={c - (c * Math.max(0, Math.min(100, value))) / 100} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-xl font-bold">{value}%</div>
    </div>
  );
}
