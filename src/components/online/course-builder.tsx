import { useState } from "react";
import { Plus, Trash2, Loader2, Video, FileText, Type, Rocket, FileQuestion, Calendar, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import {
  useCourse, useCreateModule, useDeleteModule, useCreateLesson, useDeleteLesson,
  usePublishCourse, useCourseAnalytics,
  useCourseLiveSessions, useCreateLiveSession, useDeleteLiveSession, useUpdateLiveSession,
  useCourseAssignments, useCreateAssignment, useDeleteAssignment,
  type CourseModule, type LessonType, type LiveSession, type OnlineAssignment,
} from "@/lib/online";
import { ApiError } from "@/lib/api";
import { StatusPill } from "@/components/online/shared";
import { QuizBuilder } from "@/components/online/quiz-builder";

const input = "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
type Tab = "content" | "quizzes" | "assignments" | "sessions" | "analytics";

const TAB_LABELS: Record<Tab, string> = {
  content: "Content",
  quizzes: "Quizzes",
  assignments: "Assignments",
  sessions: "Live Sessions",
  analytics: "Analytics",
};

export function CourseBuilder({ courseId }: { courseId: string }) {
  const course = useCourse(courseId);
  const publish = usePublishCourse(courseId);
  const createModule = useCreateModule(courseId);
  const [tab, setTab] = useState<Tab>("content");
  const [newModule, setNewModule] = useState("");

  if (course.isLoading) return <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (course.isError || !course.data) return <p className="text-sm text-destructive">Couldn’t load this course.</p>;
  const c = course.data;

  async function addModule(e: React.FormEvent) {
    e.preventDefault();
    if (!newModule.trim()) return;
    try {
      await createModule.mutateAsync({ title: newModule.trim() });
      setNewModule("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add module");
    }
  }

  async function onPublish() {
    try {
      await publish.mutateAsync();
      toast.success("Course published 🎉");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Publish failed");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusPill status={c.status} />
          <span className="text-sm text-muted-foreground">{c.modules.reduce((s, m) => s + m.lessons.length, 0)} lessons · {c.quizzes.length} quizzes</span>
        </div>
        {c.status !== "PUBLISHED" && (
          <button onClick={onPublish} disabled={publish.isPending}
            className="inline-flex items-center gap-2 rounded-lg grad-online px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Publish
          </button>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b">
        {(["content", "quizzes", "assignments", "sessions", "analytics"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm ${tab === t ? "border-online font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === "content" && (
        <div className="space-y-4">
          {c.modules.length === 0 && <p className="text-sm text-muted-foreground">No modules yet — add your first one below.</p>}
          {c.modules.map((m) => <ModuleEditor key={m.id} courseId={courseId} module={m} />)}

          <form onSubmit={addModule} className="flex gap-2">
            <input className={input} placeholder="New module title" value={newModule} onChange={(e) => setNewModule(e.target.value)} />
            <button type="submit" disabled={createModule.isPending}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-accent disabled:opacity-60">
              <Plus className="h-4 w-4" /> Module
            </button>
          </form>
        </div>
      )}

      {tab === "quizzes" && <QuizzesTab courseId={courseId} quizzes={c.quizzes} />}

      {tab === "assignments" && <AssignmentsTab courseId={courseId} />}

      {tab === "sessions" && <SessionsTab courseId={courseId} />}

      {tab === "analytics" && <AnalyticsTab courseId={courseId} />}
    </div>
  );
}

function LessonItem({ lesson, courseId }: { lesson: { id: string; title: string; type: string }; courseId: string }) {
  const deleteLesson = useDeleteLesson(lesson.id, courseId);
  return (
    <li className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
      <LessonTypeIcon type={lesson.type as LessonType} />
      <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
      <button onClick={() => deleteLesson.mutate()} className="text-muted-foreground hover:text-destructive" aria-label="Delete lesson">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function ModuleEditor({ courseId, module: m }: { courseId: string; module: CourseModule }) {
  const createLesson = useCreateLesson(m.id, courseId);
  const deleteModule = useDeleteModule(courseId);
  const [type, setType] = useState<LessonType>("VIDEO");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [duration, setDuration] = useState("");

  async function addLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await createLesson.mutateAsync({
        title: title.trim(),
        type,
        ...(type === "TEXT" ? { body: content } : { contentUrl: content || undefined }),
        ...(duration ? { duration: Number(duration) } : {}),
      });
      setTitle(""); setContent(""); setDuration("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add lesson");
    }
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <div className="font-medium">{m.title}</div>
        <button onClick={() => deleteModule.mutate(m.id)} className="grid h-8 w-8 place-items-center rounded-lg border text-destructive hover:bg-destructive/10" aria-label="Delete module">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <ul className="mt-3 space-y-1">
        {m.lessons.map((l) => (
          <LessonItem key={l.id} lesson={l} courseId={courseId} />
        ))}
        {m.lessons.length === 0 && <li className="px-1 text-xs text-muted-foreground">No lessons yet.</li>}
      </ul>

      <form onSubmit={addLesson} className="mt-3 grid gap-2 sm:grid-cols-[110px_1fr_auto]">
        <select className={input} value={type} onChange={(e) => setType(e.target.value as LessonType)}>
          <option value="VIDEO">Video</option>
          <option value="PDF">PDF</option>
          <option value="TEXT">Text</option>
        </select>
        <input className={input} placeholder="Lesson title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className={`${input} w-24`} placeholder="secs" value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" />
        <input
          className={`${input} sm:col-span-3`}
          placeholder={type === "TEXT" ? "Lesson text content" : "Content URL (https://…)"}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <button type="submit" disabled={createLesson.isPending}
          className="inline-flex items-center justify-center gap-1 rounded-lg grad-online px-3 py-2 text-sm font-medium text-white disabled:opacity-60 sm:col-span-3">
          {createLesson.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add lesson
        </button>
      </form>
    </div>
  );
}

function QuizzesTab({ courseId, quizzes }: { courseId: string; quizzes: { id: string; title: string; questionCount: number; passingScore: number }[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {quizzes.length === 0 && <p className="text-sm text-muted-foreground">No quizzes yet.</p>}
        {quizzes.map((q) => (
          <div key={q.id} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
            <FileQuestion className="h-4 w-4 text-warning" />
            <span className="flex-1 font-medium">{q.title}</span>
            <span className="text-xs text-muted-foreground">{q.questionCount} q · pass {q.passingScore}%</span>
          </div>
        ))}
      </div>

      {creating ? (
        <div className="rounded-xl border p-4">
          <QuizBuilder courseId={courseId} onDone={() => setCreating(false)} />
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
          <Plus className="h-4 w-4" /> New quiz
        </button>
      )}
    </div>
  );
}

function AssignmentsTab({ courseId }: { courseId: string }) {
  const assignments = useCourseAssignments(courseId);
  const createAssignment = useCreateAssignment(courseId);
  const deleteAssignment = useDeleteAssignment(courseId);
  const [form, setForm] = useState({ title: "", description: "", dueDate: "", maxScore: "100" });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.dueDate) return;
    try {
      await createAssignment.mutateAsync({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        dueDate: new Date(form.dueDate).toISOString(),
        maxScore: Number(form.maxScore) || 100,
      });
      setForm({ title: "", description: "", dueDate: "", maxScore: "100" });
      toast.success("Assignment created");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create assignment");
    }
  }

  if (assignments.isLoading) return <div className="grid h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const list = (assignments.data ?? []) as OnlineAssignment[];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {list.length === 0 && <p className="text-sm text-muted-foreground">No assignments yet.</p>}
        {list.map((a) => (
          <div key={a.id} className="flex items-start gap-3 rounded-xl border p-3 text-sm">
            <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{a.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Due: {new Date(a.dueDate).toLocaleDateString()} · {a.maxScore} pts · {a._count?.submissions ?? 0} submissions
              </div>
              {a.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{a.description}</p>}
            </div>
            <button onClick={() => deleteAssignment.mutate(a.id)} className="text-muted-foreground hover:text-destructive" title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleCreate} className="space-y-2 rounded-xl border p-4">
        <p className="mb-3 text-sm font-medium">New assignment</p>
        <input className={input} placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
        <textarea className="h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
          placeholder="Instructions (optional)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        <div className="flex gap-2">
          <input className={input} type="datetime-local" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} required />
          <input className={`${input} w-28`} type="number" min="1" placeholder="Max pts" value={form.maxScore} onChange={(e) => setForm((f) => ({ ...f, maxScore: e.target.value }))} />
        </div>
        <button type="submit" disabled={createAssignment.isPending}
          className="inline-flex w-full items-center justify-center gap-1 rounded-lg grad-online px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
          {createAssignment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add assignment
        </button>
      </form>
    </div>
  );
}

// Enregistrement d'une session : le lien renseigné ici devient visible par les
// étudiants du cours (dans le cursus, les étudiants en ligne uniquement).
function RecordingField({ session }: { session: LiveSession }) {
  const update = useUpdateLiveSession();
  const [url, setUrl] = useState(session.recordingUrl ?? "");
  const dirty = url.trim() !== (session.recordingUrl ?? "");
  async function save() {
    try {
      await update.mutateAsync({ sessionId: session.id, recordingUrl: url.trim() || null });
      toast.success(url.trim() ? "Enregistrement publié" : "Enregistrement retiré");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Enregistrement impossible");
    }
  }
  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        className={`${input} h-8 text-xs`}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Lien de l'enregistrement autorisé (https://…)"
        aria-label="Lien de l'enregistrement"
      />
      <button type="button" onClick={save} disabled={!dirty || update.isPending}
        className="shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-40">
        Publier
      </button>
    </div>
  );
}

function SessionsTab({ courseId }: { courseId: string }) {
  const sessions = useCourseLiveSessions(courseId);
  const createSession = useCreateLiveSession(courseId);
  const deleteSession = useDeleteLiveSession();
  const [form, setForm] = useState({ title: "", scheduledAt: "", durationMin: "60", link: "" });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.scheduledAt) return;
    try {
      await createSession.mutateAsync({
        title: form.title.trim(),
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        durationMin: Number(form.durationMin) || 60,
        link: form.link.trim() || undefined,
      });
      setForm({ title: "", scheduledAt: "", durationMin: "60", link: "" });
      toast.success("Session scheduled");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create session");
    }
  }

  if (sessions.isLoading) return <div className="grid h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const list = (sessions.data ?? []) as LiveSession[];
  const statusColor: Record<string, string> = {
    SCHEDULED: "text-blue-500",
    LIVE: "text-red-500",
    DONE: "text-muted-foreground",
    CANCELLED: "text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {list.length === 0 && <p className="text-sm text-muted-foreground">No sessions yet.</p>}
        {list.map((s) => (
          <div key={s.id} className="flex items-start gap-3 rounded-xl border p-3 text-sm">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{s.title}</span>
                <span className={`text-xs font-medium uppercase ${statusColor[s.status] ?? ""}`}>{s.status}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {new Date(s.scheduledAt).toLocaleString()} · {s.durationMin} min
              </div>
              {s.link && <a href={s.link} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-xs text-online hover:underline">{s.link}</a>}
              <RecordingField session={s} />
            </div>
            <button onClick={() => deleteSession.mutate(s.id)} className="text-muted-foreground hover:text-destructive" title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleCreate} className="space-y-2 rounded-xl border p-4">
        <p className="mb-3 text-sm font-medium">Schedule a live session</p>
        <input className={input} placeholder="Session title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
        <input className={input} type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))} required />
        <div className="flex gap-2">
          <input className={`${input} w-32`} type="number" min="1" placeholder="Duration (min)" value={form.durationMin} onChange={(e) => setForm((f) => ({ ...f, durationMin: e.target.value }))} />
          <input className={input} placeholder="Join link (Zoom, Meet…)" value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} />
        </div>
        <button type="submit" disabled={createSession.isPending}
          className="inline-flex w-full items-center justify-center gap-1 rounded-lg grad-online px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
          {createSession.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Schedule session
        </button>
      </form>
    </div>
  );
}

function AnalyticsTab({ courseId }: { courseId: string }) {
  const analytics = useCourseAnalytics(courseId);
  if (analytics.isLoading) return <div className="grid h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (analytics.isError || !analytics.data) return <p className="text-sm text-destructive">Couldn’t load analytics.</p>;
  const a = analytics.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Enrollments" value={a.enrollments} />
        <Metric label="Completed" value={a.completed} />
        <Metric label="Completion" value={`${a.completionRate}%`} />
        <Metric label="Avg progress" value={`${a.avgProgress}%`} />
      </div>
      <div className="rounded-xl border">
        <div className="border-b p-3 text-sm font-medium">Quiz performance</div>
        {a.quizzes.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No quizzes.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="text-left"><th className="p-3">Quiz</th><th>Attempts</th><th>Pass rate</th><th>Avg score</th></tr>
            </thead>
            <tbody>
              {a.quizzes.map((q) => (
                <tr key={q.quizId} className="border-t">
                  <td className="p-3 font-medium">{q.title}</td>
                  <td>{q.attempts}</td>
                  <td>{q.passRate}%</td>
                  <td>{q.avgScore}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function LessonTypeIcon({ type }: { type: LessonType }) {
  if (type === "VIDEO") return <Video className="h-4 w-4 text-muted-foreground" />;
  if (type === "PDF") return <FileText className="h-4 w-4 text-muted-foreground" />;
  return <Type className="h-4 w-4 text-muted-foreground" />;
}
