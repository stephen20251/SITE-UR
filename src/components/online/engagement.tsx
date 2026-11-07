// Online LMS engagement UI — course reviews/ratings, Q&A forum, lesson notes.
import { useState } from "react";
import {
  Star, ThumbsUp, Check, CheckCircle2, MessageCircle, Bookmark, BookmarkCheck,
  Trash2, Send, Plus, Loader2, ChevronDown, ShieldCheck, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  useCourseReviews, useUpsertReview, useDeleteMyReview, useReplyToReview, useSetReviewHidden,
  useCourseQuestions, useQuestion, useCreateQuestion, useDeleteQuestion,
  useCreateAnswer, useDeleteAnswer, useUpvoteQuestion, useUpvoteAnswer, useAcceptAnswer, useSetQuestionResolved,
  useLessonNotes, useCreateNote, useDeleteNote,
  useCourseAnnouncements, useCreateAnnouncement, useUpdateAnnouncement, useDeleteAnnouncement,
  type CourseDetail, type CourseReview, type QaQuestion, type QaAnswer, type CourseLesson,
} from "@/lib/online";
import { Megaphone, Pin } from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

function initials(f?: string, l?: string) {
  return `${(f ?? "?")[0] ?? ""}${(l ?? "")[0] ?? ""}`.toUpperCase();
}

function fmtTime(sec: number | null | undefined): string {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function Avatar({ user }: { user?: { firstName: string; lastName: string; avatarUrl?: string | null } }) {
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-[11px] font-bold text-white">
      {initials(user?.firstName, user?.lastName)}
    </div>
  );
}

// ─── Stars ──────────────────────────────────────────────────────────────────

export function Stars({
  value, size = 16, interactive = false, onChange,
}: {
  value: number;
  size?: number;
  interactive?: boolean;
  onChange?: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = interactive ? i <= shown : i <= Math.round(value);
        const half = !interactive && !filled && i - 0.5 <= value;
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(i)}
            onMouseEnter={() => interactive && setHover(i)}
            onMouseLeave={() => interactive && setHover(0)}
            className={interactive ? "cursor-pointer transition-transform hover:scale-110" : "cursor-default"}
            aria-label={`${i} étoile${i > 1 ? "s" : ""}`}
          >
            <Star
              width={size}
              height={size}
              className={
                filled || half
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-muted-foreground/40"
              }
            />
          </button>
        );
      })}
    </div>
  );
}

// Compact inline rating for catalogue cards.
export function RatingBadge({ avg, count, className = "" }: { avg?: number; count?: number; className?: string }) {
  if (!count) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${className}`}>
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
      {avg?.toFixed(1)}
      <span className="text-muted-foreground">({count})</span>
    </span>
  );
}

// ─── Reviews ────────────────────────────────────────────────────────────────

export function ReviewsSection({ course }: { course: CourseDetail }) {
  const { data, isLoading } = useCourseReviews(course.id);
  const summary = data?.summary;
  const canReview = course.enrolled && !course.isOwner;

  return (
    <section className="border-t bg-muted/10 p-5 md:p-8">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold tracking-tight">
        <Star className="h-5 w-5 text-amber-400" /> Avis & notes
      </h2>

      {/* Summary */}
      <div className="mb-6 flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-elegant sm:flex-row sm:items-center">
        <div className="flex flex-col items-center justify-center sm:w-40 sm:border-r sm:pr-5">
          <div className="text-4xl font-extrabold">{(summary?.avg ?? 0).toFixed(1)}</div>
          <Stars value={summary?.avg ?? 0} size={18} />
          <div className="mt-1 text-xs text-muted-foreground">{summary?.count ?? 0} avis</div>
        </div>
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = summary?.distribution?.[String(n)] ?? 0;
            const total = summary?.count ?? 0;
            const pct = total ? (c / total) * 100 : 0;
            return (
              <div key={n} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-muted-foreground">{n}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-6 text-right text-muted-foreground">{c}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* My review editor */}
      {canReview && <MyReviewEditor course={course} />}
      {course.isOwner && (
        <p className="mb-6 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
          Vous êtes l'enseignant de ce cours — vous pouvez répondre aux avis et les masquer.
        </p>
      )}

      {/* Review list */}
      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : data && data.items.length > 0 ? (
        <div className="space-y-3">
          {data.items.map((r) => (
            <ReviewCard key={r.id} review={r} courseId={course.id} isOwner={course.isOwner} />
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Aucun avis pour l'instant. {canReview && "Soyez le premier à donner votre avis !"}
        </p>
      )}
    </section>
  );
}

function MyReviewEditor({ course }: { course: CourseDetail }) {
  const existing = course.myReview;
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [editing, setEditing] = useState(!existing);
  const upsert = useUpsertReview(course.id);
  const del = useDeleteMyReview(course.id);

  async function save() {
    if (rating < 1) { toast.error("Choisissez une note"); return; }
    try {
      await upsert.mutateAsync({ rating, comment });
      toast.success("Avis enregistré");
      setEditing(false);
    } catch { toast.error("Impossible d'enregistrer l'avis"); }
  }

  if (existing && !editing) {
    return (
      <div className="mb-6 rounded-2xl border border-amber-300/50 bg-amber-50/50 p-4 dark:bg-amber-950/10">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stars value={existing.rating} size={16} />
            <span className="text-xs font-medium text-muted-foreground">Votre avis</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(true)} className="text-xs text-online hover:underline">Modifier</button>
            <button
              onClick={async () => { if (confirm("Supprimer votre avis ?")) { await del.mutateAsync(); toast.success("Avis supprimé"); setRating(0); setComment(""); setEditing(true); } }}
              className="text-xs text-destructive hover:underline"
            >Supprimer</button>
          </div>
        </div>
        {existing.comment && <p className="text-sm">{existing.comment}</p>}
        {existing.reply && (
          <div className="mt-3 rounded-lg border-l-2 border-online bg-card p-2.5 text-sm">
            <div className="mb-0.5 flex items-center gap-1 text-xs font-semibold text-online">
              <ShieldCheck className="h-3 w-3" /> Réponse de l'enseignant
            </div>
            {existing.reply}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border bg-card p-4 shadow-elegant">
      <div className="mb-2 text-sm font-semibold">{existing ? "Modifier votre avis" : "Donnez votre avis"}</div>
      <Stars value={rating} size={26} interactive onChange={setRating} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Partagez votre expérience (facultatif)…"
        className="mt-3 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={save}
          disabled={upsert.isPending}
          className="inline-flex items-center gap-2 rounded-lg grad-online px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Publier
        </button>
        {existing && (
          <button onClick={() => setEditing(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Annuler</button>
        )}
      </div>
    </div>
  );
}

function ReviewCard({ review, courseId, isOwner }: { review: CourseReview; courseId: string; isOwner: boolean }) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(review.reply ?? "");
  const replyMut = useReplyToReview(courseId);
  const hideMut = useSetReviewHidden(courseId);

  return (
    <div className={`rounded-2xl border bg-card p-4 shadow-elegant ${review.isHidden ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3">
        <Avatar user={review.student} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">{review.student?.firstName} {review.student?.lastName}</div>
            <div className="text-xs text-muted-foreground">{fmtDate(review.createdAt)}</div>
          </div>
          <Stars value={review.rating} size={13} />
          {review.comment && <p className="mt-1.5 text-sm leading-relaxed">{review.comment}</p>}

          {/* Teacher reply */}
          {review.reply && !replying && (
            <div className="mt-3 rounded-lg border-l-2 border-online bg-muted/30 p-2.5 text-sm">
              <div className="mb-0.5 flex items-center gap-1 text-xs font-semibold text-online">
                <ShieldCheck className="h-3 w-3" /> Réponse de l'enseignant
              </div>
              {review.reply}
            </div>
          )}

          {/* Owner actions */}
          {isOwner && (
            <div className="mt-2 flex items-center gap-3 text-xs">
              <button onClick={() => setReplying((v) => !v)} className="text-online hover:underline">
                {review.reply ? "Modifier la réponse" : "Répondre"}
              </button>
              <button
                onClick={async () => { await hideMut.mutateAsync({ reviewId: review.id, isHidden: !review.isHidden }); }}
                className="text-muted-foreground hover:underline"
              >
                {review.isHidden ? "Réafficher" : "Masquer"}
              </button>
            </div>
          )}

          {replying && (
            <div className="mt-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={2}
                placeholder="Votre réponse…"
                className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-1.5 flex gap-2">
                <button
                  onClick={async () => { await replyMut.mutateAsync({ reviewId: review.id, reply }); toast.success("Réponse envoyée"); setReplying(false); }}
                  disabled={replyMut.isPending}
                  className="rounded-lg grad-online px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                >Envoyer</button>
                <button onClick={() => setReplying(false)} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-accent">Annuler</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Q&A forum ──────────────────────────────────────────────────────────────

export function QASection({ course, lessons }: { course: CourseDetail; lessons: CourseLesson[] }) {
  const { data, isLoading } = useCourseQuestions(course.id);
  const [asking, setAsking] = useState(false);

  return (
    <section className="border-t p-5 md:p-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <MessageCircle className="h-5 w-5 text-online" /> Questions & réponses
          {data && <span className="text-sm font-normal text-muted-foreground">({data.total})</span>}
        </h2>
        {(course.enrolled || course.isOwner) && (
          <button
            onClick={() => setAsking((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg grad-online px-3 py-1.5 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Poser une question
          </button>
        )}
      </div>

      {asking && (
        <AskQuestionForm course={course} lessons={lessons} onDone={() => setAsking(false)} />
      )}

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : data && data.items.length > 0 ? (
        <div className="space-y-3">
          {data.items.map((q) => <QuestionRow key={q.id} question={q} course={course} />)}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Aucune question pour l'instant.{(course.enrolled || course.isOwner) && " Lancez la discussion !"}
        </p>
      )}
    </section>
  );
}

function AskQuestionForm({ course, lessons, onDone }: { course: CourseDetail; lessons: CourseLesson[]; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [lessonId, setLessonId] = useState("");
  const create = useCreateQuestion(course.id);

  async function submit() {
    if (!title.trim() || !body.trim()) { toast.error("Titre et question requis"); return; }
    try {
      await create.mutateAsync({ title, body, lessonId: lessonId || undefined });
      toast.success("Question publiée");
      onDone();
    } catch { toast.error("Impossible de publier la question"); }
  }

  return (
    <div className="mb-4 rounded-2xl border bg-card p-4 shadow-elegant">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre de votre question"
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-ring"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Décrivez votre question en détail…"
        className="mt-2 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      {lessons.length > 0 && (
        <select
          value={lessonId}
          onChange={(e) => setLessonId(e.target.value)}
          className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">— Question générale —</option>
          {lessons.map((l) => <option key={l.id} value={l.id}>Leçon : {l.title}</option>)}
        </select>
      )}
      <div className="mt-2 flex gap-2">
        <button onClick={submit} disabled={create.isPending}
          className="inline-flex items-center gap-2 rounded-lg grad-online px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publier
        </button>
        <button onClick={onDone} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Annuler</button>
      </div>
    </div>
  );
}

function QuestionRow({ question, course }: { question: QaQuestion; course: CourseDetail }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const detail = useQuestion(question.id, { enabled: open });
  const upvote = useUpvoteQuestion();
  const del = useDeleteQuestion(course.id);
  const upvoted = user ? question.upvotes.includes(user.id) : false;
  const canDelete = course.isOwner || question.author.id === user?.id;

  return (
    <div className="rounded-2xl border bg-card shadow-elegant">
      <div className="flex items-start gap-3 p-4">
        <button
          onClick={() => upvote.mutate(question.id)}
          className={`flex shrink-0 flex-col items-center rounded-lg border px-2 py-1 text-xs transition ${upvoted ? "border-online bg-online/10 text-online" : "hover:bg-accent"}`}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          {question.upvotes.length}
        </button>
        <button onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            {question.resolved && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                <CheckCircle2 className="h-3 w-3" /> Résolu
              </span>
            )}
            <span className="truncate text-sm font-semibold">{question.title}</span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{question.body}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>{question.author.firstName} {question.author.lastName}</span>
            <span>·</span>
            <span>{fmtDate(question.createdAt)}</span>
            {question.lesson && <><span>·</span><span className="text-online">📎 {question.lesson.title}</span></>}
            <span>·</span>
            <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{question._count.answers}</span>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {canDelete && (
            <button
              onClick={async () => { if (confirm("Supprimer cette question ?")) { await del.mutateAsync(question.id); toast.success("Supprimé"); } }}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            ><Trash2 className="h-3.5 w-3.5" /></button>
          )}
          <button onClick={() => setOpen((v) => !v)} className="rounded p-1 hover:bg-accent">
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t bg-muted/10 p-4">
          {detail.isLoading ? (
            <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : (
            <QuestionThread question={detail.data ?? question} course={course} />
          )}
        </div>
      )}
    </div>
  );
}

function QuestionThread({ question, course }: { question: QaQuestion; course: CourseDetail }) {
  const { user } = useAuth();
  const [answer, setAnswer] = useState("");
  const createAnswer = useCreateAnswer(course.id);
  const setResolved = useSetQuestionResolved(course.id);
  const answers = question.answers ?? [];
  const canResolve = course.isOwner || question.author.id === user?.id;

  async function submit() {
    if (!answer.trim()) return;
    try {
      await createAnswer.mutateAsync({ questionId: question.id, body: answer });
      setAnswer("");
    } catch { toast.error("Impossible de publier la réponse"); }
  }

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap text-sm">{question.body}</p>

      {canResolve && (
        <button
          onClick={() => setResolved.mutate({ questionId: question.id, resolved: !question.resolved })}
          className="text-xs text-online hover:underline"
        >
          {question.resolved ? "Marquer non résolu" : "Marquer comme résolu"}
        </button>
      )}

      <div className="space-y-2 border-t pt-3">
        {answers.length === 0 && <p className="text-xs text-muted-foreground">Aucune réponse pour l'instant.</p>}
        {answers.map((a) => (
          <AnswerCard key={a.id} answer={a} question={question} course={course} />
        ))}
      </div>

      {/* Answer composer */}
      {(course.enrolled || course.isOwner) && (
        <div className="flex items-end gap-2 border-t pt-3">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={2}
            placeholder="Écrire une réponse…"
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button onClick={submit} disabled={createAnswer.isPending || !answer.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg grad-online px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            {createAnswer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  );
}

function AnswerCard({ answer, question, course }: { answer: QaAnswer; question: QaQuestion; course: CourseDetail }) {
  const { user } = useAuth();
  const upvote = useUpvoteAnswer();
  const accept = useAcceptAnswer();
  const del = useDeleteAnswer(course.id);
  const upvoted = user ? answer.upvotes.includes(user.id) : false;
  const canAccept = course.isOwner || question.author.id === user?.id;
  const canDelete = course.isOwner || answer.author.id === user?.id;

  return (
    <div className={`rounded-xl border p-3 ${answer.isAccepted ? "border-success/50 bg-success/5" : "bg-card"}`}>
      <div className="flex items-start gap-2.5">
        <Avatar user={answer.author} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{answer.author.firstName} {answer.author.lastName}</span>
            {answer.isInstructor && (
              <span className="inline-flex items-center gap-1 rounded-full bg-online/10 px-2 py-0.5 text-[10px] font-semibold text-online">
                <ShieldCheck className="h-3 w-3" /> Enseignant
              </span>
            )}
            {answer.isAccepted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                <Check className="h-3 w-3" /> Réponse acceptée
              </span>
            )}
            <span className="ml-auto text-[11px] text-muted-foreground">{fmtDate(answer.createdAt)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{answer.body}</p>
          <div className="mt-1.5 flex items-center gap-3 text-xs">
            <button
              onClick={() => upvote.mutate({ answerId: answer.id, questionId: question.id })}
              className={`inline-flex items-center gap-1 ${upvoted ? "text-online" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ThumbsUp className="h-3.5 w-3.5" /> {answer.upvotes.length}
            </button>
            {canAccept && !answer.isAccepted && (
              <button
                onClick={() => accept.mutate({ answerId: answer.id, questionId: question.id })}
                className="text-success hover:underline"
              >Accepter</button>
            )}
            {canDelete && (
              <button
                onClick={async () => { if (confirm("Supprimer cette réponse ?")) await del.mutateAsync({ answerId: answer.id, questionId: question.id }); }}
                className="text-muted-foreground hover:text-destructive"
              ><Trash2 className="h-3.5 w-3.5" /></button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Course announcements ───────────────────────────────────────────────────

export function AnnouncementsSection({ course }: { course: CourseDetail }) {
  const { data: items = [], isLoading } = useCourseAnnouncements(course.id);
  const create = useCreateAnnouncement(course.id);
  const update = useUpdateAnnouncement(course.id);
  const del = useDeleteAnnouncement(course.id);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  async function publish() {
    if (!title.trim() || !body.trim()) { toast.error("Titre et contenu requis"); return; }
    try {
      await create.mutateAsync({ title, body });
      toast.success("Annonce publiée — les inscrits sont notifiés");
      setTitle(""); setBody(""); setComposing(false);
    } catch { toast.error("Impossible de publier l'annonce"); }
  }

  if (!course.isOwner && !isLoading && items.length === 0) return null;

  return (
    <section className="border-t bg-online/[0.03] p-5 md:p-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Megaphone className="h-5 w-5 text-online" /> Annonces
          {items.length > 0 && <span className="text-sm font-normal text-muted-foreground">({items.length})</span>}
        </h2>
        {course.isOwner && (
          <button
            onClick={() => setComposing((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg grad-online px-3 py-1.5 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Nouvelle annonce
          </button>
        )}
      </div>

      {composing && (
        <div className="mb-4 rounded-2xl border bg-card p-4 shadow-elegant">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de l'annonce"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-ring"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Contenu — les inscrits recevront une notification…"
            className="mt-2 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-2 flex gap-2">
            <button onClick={publish} disabled={create.isPending}
              className="inline-flex items-center gap-2 rounded-lg grad-online px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publier
            </button>
            <button onClick={() => setComposing(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Annuler</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Aucune annonce pour l'instant.</p>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <div key={a.id} className={`rounded-2xl border bg-card p-4 shadow-elegant ${a.isPinned ? "border-online/40" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {a.isPinned && <Pin className="h-3.5 w-3.5 shrink-0 text-online" />}
                  <span className="text-sm font-semibold">{a.title}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{fmtDate(a.createdAt)}</span>
                  {course.isOwner && (
                    <>
                      <button
                        onClick={() => update.mutate({ id: a.id, isPinned: !a.isPinned })}
                        title={a.isPinned ? "Désépingler" : "Épingler"}
                        className={`rounded p-1 hover:bg-accent ${a.isPinned ? "text-online" : "text-muted-foreground"}`}
                      ><Pin className="h-3.5 w-3.5" /></button>
                      <button
                        onClick={async () => { if (confirm("Supprimer cette annonce ?")) { await del.mutateAsync(a.id); toast.success("Supprimée"); } }}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      ><Trash2 className="h-3.5 w-3.5" /></button>
                    </>
                  )}
                </div>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{a.body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Lesson notes & bookmarks ────────────────────────────────────────────────

export function NotesPanel({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const { data: notes, isLoading } = useLessonNotes({ courseId, lessonId });
  const create = useCreateNote();
  const del = useDeleteNote();
  const [body, setBody] = useState("");
  const [withTimestamp, setWithTimestamp] = useState(true);

  // Grab the current time of the visible lesson video, if any.
  function currentVideoTime(): number | null {
    if (!withTimestamp) return null;
    const v = document.querySelector("video");
    return v && !Number.isNaN(v.currentTime) ? Math.floor(v.currentTime) : null;
  }

  async function addNote() {
    if (!body.trim()) { toast.error("Note vide"); return; }
    try {
      await create.mutateAsync({ courseId, lessonId, body, timestamp: currentVideoTime() });
      setBody("");
    } catch { toast.error("Impossible d'ajouter la note"); }
  }

  async function addBookmark() {
    try {
      await create.mutateAsync({ courseId, lessonId, isBookmark: true, timestamp: currentVideoTime() });
      toast.success("Marque-page ajouté");
    } catch { toast.error("Impossible d'ajouter le marque-page"); }
  }

  function seekTo(sec: number | null) {
    if (sec == null) return;
    const v = document.querySelector("video");
    if (v) { v.currentTime = sec; v.play?.().catch(() => {}); }
  }

  return (
    <div className="rounded-2xl border bg-card shadow-elegant overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3 text-sm font-semibold">
        <Bookmark className="h-4 w-4 text-online" /> Mes notes
        {notes && notes.length > 0 && (
          <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">{notes.length}</span>
        )}
      </div>

      <div className="p-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Prendre une note sur cette leçon…"
          className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button onClick={addNote} disabled={create.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg grad-online px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
            {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Ajouter
          </button>
          <button onClick={addBookmark} disabled={create.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60">
            <BookmarkCheck className="h-3.5 w-3.5" /> Marque-page
          </button>
          <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
            <input type="checkbox" checked={withTimestamp} onChange={(e) => setWithTimestamp(e.target.checked)} className="rounded" />
            Horodater (vidéo)
          </label>
        </div>

        {/* List */}
        <div className="mt-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : notes && notes.length > 0 ? (
            notes.map((n) => (
              <div key={n.id} className={`group flex items-start gap-2 rounded-lg border p-2.5 ${n.isBookmark ? "border-amber-300/50 bg-amber-50/40 dark:bg-amber-950/10" : "bg-background"}`}>
                {n.isBookmark
                  ? <BookmarkCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  : <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  {n.timestamp != null && (
                    <button
                      onClick={() => seekTo(n.timestamp)}
                      className="inline-flex items-center gap-1 rounded bg-online/10 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-online hover:bg-online/20"
                    >
                      <Clock className="h-2.5 w-2.5" /> {fmtTime(n.timestamp)}
                    </button>
                  )}
                  {n.body && <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed">{n.body}</p>}
                </div>
                <button
                  onClick={() => del.mutate(n.id)}
                  className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                ><Trash2 className="h-3 w-3" /></button>
              </div>
            ))
          ) : (
            <p className="py-2 text-center text-xs text-muted-foreground">Aucune note sur cette leçon.</p>
          )}
        </div>
      </div>
    </div>
  );
}
