// Modification d'un QCM existant (enseignant propriétaire du cours ou Super Admin) :
// réglages, questions, réponses et bonnes réponses — question par question. Les
// résultats déjà obtenus par les étudiants sont conservés.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { useQuiz, useQuizEditor, type QuestionInput, type QuizQuestion } from "@/lib/online";
import { ApiError } from "@/lib/api";

type QType = "MCQ_SINGLE" | "MCQ_MULTI" | "TRUE_FALSE";
const TYPE_LABEL: Record<QType, string> = { MCQ_SINGLE: "Choix unique", MCQ_MULTI: "Choix multiples", TRUE_FALSE: "Vrai / Faux" };
const inp = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-online/40";
const err = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Échec de l'enregistrement");

export function QuizEditor({ quizId, courseId }: { quizId: string; courseId?: string }) {
  const quiz = useQuiz(quizId);
  const ed = useQuizEditor(quizId, courseId ?? quiz.data?.courseId);
  const [adding, setAdding] = useState(false);

  if (quiz.isLoading) return <div className="grid h-32 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (quiz.isError || !quiz.data) return <p className="text-sm text-destructive">Impossible de charger ce QCM.</p>;
  const q = quiz.data;

  return (
    <div className="space-y-5">
      <MetaForm quiz={q} onSave={(patch) => ed.updateQuiz.mutateAsync(patch).then(() => toast.success("Réglages du QCM enregistrés")).catch(err)} saving={ed.updateQuiz.isPending} />

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{q.questions.length} question{q.questions.length > 1 ? "s" : ""}</h3>
        {!adding && (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-lg grad-online px-3 py-1.5 text-xs font-semibold text-white">
            <Plus className="h-3.5 w-3.5" /> Ajouter une question
          </button>
        )}
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">Les résultats déjà obtenus par les étudiants sont conservés ; les modifications valent pour les prochaines tentatives.</p>

      <div className="space-y-3">
        {q.questions.map((question, i) => (
          <QuestionCard key={question.id} index={i} question={question}
            onSave={(input) => ed.updateQuestion.mutateAsync({ id: question.id, ...input }).then(() => toast.success(`Question ${i + 1} enregistrée`)).catch((e) => { err(e); throw e; })}
            onDelete={() => {
              if (!confirm(`Supprimer la question ${i + 1} ? Les résultats déjà enregistrés sont conservés.`)) return;
              ed.deleteQuestion.mutateAsync(question.id).then(() => toast.success("Question supprimée")).catch(err);
            }} />
        ))}
        {adding && (
          <QuestionCard index={q.questions.length} isNew
            question={{ id: "", text: "", type: "MCQ_SINGLE", points: 1, order: q.questions.length, options: [{ id: "", text: "", isCorrect: true }, { id: "", text: "", isCorrect: false }] }}
            onCancel={() => setAdding(false)}
            onSave={(input) => ed.addQuestion.mutateAsync(input).then(() => { setAdding(false); toast.success("Question ajoutée"); }).catch((e) => { err(e); throw e; })} />
        )}
      </div>
    </div>
  );
}

function MetaForm({ quiz, onSave, saving }: {
  quiz: { title: string; description: string | null; passingScore: number; timeLimit: number | null; audience?: string };
  onSave: (p: { title: string; description: string | null; passingScore: number; timeLimit: number | null; audience: "ALL" | "STUDENT" | "PUBLIC" }) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(quiz.title);
  const [description, setDescription] = useState(quiz.description ?? "");
  const [passingScore, setPassingScore] = useState(String(quiz.passingScore));
  const [timeLimit, setTimeLimit] = useState(quiz.timeLimit ? String(quiz.timeLimit) : "");
  const [audience, setAudience] = useState<"ALL" | "STUDENT" | "PUBLIC">((quiz.audience as "ALL" | "STUDENT" | "PUBLIC") ?? "ALL");
  return (
    <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
      <label className="text-xs font-medium text-muted-foreground sm:col-span-2">Titre
        <input className={`${inp} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="text-xs font-medium text-muted-foreground sm:col-span-2">Consigne (facultative)
        <textarea className={`${inp} mt-1`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="text-xs font-medium text-muted-foreground">Score pour réussir (%)
        <input type="number" min={0} max={100} className={`${inp} mt-1`} value={passingScore} onChange={(e) => setPassingScore(e.target.value)} />
      </label>
      <label className="text-xs font-medium text-muted-foreground">Durée (minutes, vide = sans limite)
        <input type="number" min={1} max={600} className={`${inp} mt-1`} value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} />
      </label>
      <label className="text-xs font-medium text-muted-foreground">Public
        <select className={`${inp} mt-1`} value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
          <option value="ALL">Tous les apprenants</option>
          <option value="STUDENT">Étudiants du cursus</option>
          <option value="PUBLIC">Apprenants hors cursus</option>
        </select>
      </label>
      <div className="flex items-end">
        <button disabled={saving || !title.trim()} onClick={() => onSave({
          title: title.trim(), description: description.trim() || null,
          passingScore: Math.max(0, Math.min(100, Number(passingScore) || 0)),
          timeLimit: timeLimit ? Math.max(1, Number(timeLimit)) : null, audience,
        })} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer les réglages
        </button>
      </div>
    </div>
  );
}

function QuestionCard({ index, question, onSave, onDelete, onCancel, isNew = false }: {
  index: number; question: QuizQuestion; isNew?: boolean;
  onSave: (input: QuestionInput) => Promise<unknown>;
  onDelete?: () => void; onCancel?: () => void;
}) {
  const [text, setText] = useState(question.text);
  const [type, setType] = useState<QType>(question.type as QType);
  const [points, setPoints] = useState(String(question.points));
  const [explanation, setExplanation] = useState(question.explanation ?? "");
  const [options, setOptions] = useState(question.options.map((o) => ({ id: o.id || undefined, text: o.text, isCorrect: !!o.isCorrect })));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(isNew);
  useEffect(() => { if (!isNew) setDirty(false); }, [question, isNew]);

  const touch = () => setDirty(true);
  function setTypeSafe(t: QType) {
    touch(); setType(t);
    if (t === "TRUE_FALSE") setOptions([{ id: options[0]?.id, text: "Vrai", isCorrect: true }, { id: options[1]?.id, text: "Faux", isCorrect: false }]);
    if (t === "MCQ_SINGLE") { const first = options.findIndex((o) => o.isCorrect); setOptions(options.map((o, i) => ({ ...o, isCorrect: i === (first < 0 ? 0 : first) }))); }
  }
  function toggleCorrect(i: number) {
    touch();
    setOptions(options.map((o, j) => (type === "MCQ_MULTI" ? (j === i ? { ...o, isCorrect: !o.isCorrect } : o) : { ...o, isCorrect: j === i })));
  }
  async function save() {
    const clean = options.map((o) => ({ ...o, text: o.text.trim() })).filter((o) => o.text);
    if (!text.trim()) { toast.error("Écrivez l'énoncé de la question"); return; }
    if (clean.length < 2) { toast.error("Au moins deux réponses"); return; }
    if (!clean.some((o) => o.isCorrect)) { toast.error("Cochez la bonne réponse"); return; }
    setSaving(true);
    try {
      await onSave({ text: text.trim(), type, points: Math.max(0.5, Number(points) || 1), explanation: explanation.trim() || null, options: clean.map((o) => ({ ...(o.id && { id: o.id }), text: o.text, isCorrect: o.isCorrect })) });
      setDirty(false);
    } catch { /* message déjà affiché */ } finally { setSaving(false); }
  }

  return (
    <div className={`rounded-xl border p-4 ${dirty ? "border-online/50 shadow-sm" : ""}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-online/10 px-2 py-0.5 text-xs font-bold text-online">Q{index + 1}</span>
        <select className="rounded-lg border bg-background px-2 py-1 text-xs" value={type} onChange={(e) => setTypeSafe(e.target.value as QType)}>
          {(Object.keys(TYPE_LABEL) as QType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">Points
          <input type="number" min={0.5} step={0.5} className="w-16 rounded-lg border bg-background px-2 py-1 text-xs" value={points} onChange={(e) => { touch(); setPoints(e.target.value); }} />
        </label>
        <div className="ml-auto flex gap-1">
          {onDelete && <button onClick={onDelete} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950" title="Supprimer la question"><Trash2 className="h-4 w-4" /></button>}
          {onCancel && <button onClick={onCancel} className="rounded-lg p-1.5 hover:bg-accent" title="Annuler"><X className="h-4 w-4" /></button>}
        </div>
      </div>
      <textarea className={inp} rows={2} placeholder="Énoncé de la question" value={text} onChange={(e) => { touch(); setText(e.target.value); }} />
      <div className="mt-3 space-y-2">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <button type="button" onClick={() => toggleCorrect(i)} title={o.isCorrect ? "Bonne réponse" : "Marquer comme bonne réponse"}
              className={`shrink-0 ${o.isCorrect ? "text-success" : "text-muted-foreground hover:text-foreground"}`}>
              {o.isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
            </button>
            <input className={`${inp} ${o.isCorrect ? "border-success/50" : ""}`} placeholder={`Réponse ${i + 1}`} value={o.text}
              disabled={type === "TRUE_FALSE"} onChange={(e) => { touch(); setOptions(options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x))); }} />
            {type !== "TRUE_FALSE" && options.length > 2 && (
              <button onClick={() => { touch(); setOptions(options.filter((_, j) => j !== i)); }} className="rounded p-1 text-muted-foreground hover:text-destructive" title="Retirer"><X className="h-4 w-4" /></button>
            )}
          </div>
        ))}
        {type !== "TRUE_FALSE" && options.length < 8 && (
          <button onClick={() => { touch(); setOptions([...options, { id: undefined, text: "", isCorrect: false }]); }} className="text-xs font-medium text-online hover:underline">+ Ajouter une réponse</button>
        )}
      </div>
      <input className={`${inp} mt-3`} placeholder="Explication affichée à la correction (facultative)" value={explanation} onChange={(e) => { touch(); setExplanation(e.target.value); }} />
      {dirty && (
        <div className="mt-3 flex justify-end">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg grad-online px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {isNew ? "Ajouter la question" : "Enregistrer la question"}
          </button>
        </div>
      )}
    </div>
  );
}
