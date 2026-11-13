import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, BookOpen, CheckCircle2, Circle, ListChecks, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";
import {
  Card, CourseStatusBadge, Empty, HoursSummary, Loading, PageHeader, Tabs, btnGhost, btnPrimary, inputCls,
} from "@/components/classroom/cursus-ui";
import {
  fmtMGA, useMyEarnings, useSyllabusMutations, useTeacherCourses,
  type Assignment, type CursusCourse,
} from "@/lib/cursus";
import { api, ApiError } from "@/lib/api";
import { cursusPlace } from "@/lib/cursus";

export const Route = createFileRoute("/classroom/mes-cours")({ component: MyCourses });

type Tab = "PRESENT" | "UPCOMING" | "COMPLETED";

function MyCourses() {
  const { user, ready } = useRequireClassroom(["TEACHER"]);
  const data = useTeacherCourses(ready && !!user);
  const earnings = useMyEarnings(ready && !!user);
  const [tab, setTab] = useState<Tab>("PRESENT");
  const [creating, setCreating] = useState<Assignment | null>(null);
  const [newCourse, setNewCourse] = useState(false);

  if (!ready || !user || data.isLoading) return <Loading />;
  if (!data.data) return <Empty>Impossible de charger vos cours.</Empty>;
  const d = data.data;
  const list = tab === "PRESENT" ? d.present : tab === "UPCOMING" ? d.upcoming : d.completed;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes cours"
        subtitle={`Déroulement de vos cours du cursus${d.currentMonth ? ` · mois en cours : ${d.currentMonth}` : ""}`}
        actions={<div className="flex gap-2">
          <button onClick={() => setNewCourse(true)} className={btnPrimary}><Plus className="h-4 w-4" /> Nouveau cours</button>
          <Link to="/online/teacher" className={btnGhost}><BookOpen className="h-4 w-4" /> Mes cours en ligne & studio</Link>
        </div>}
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Card><div className="text-xs text-muted-foreground">En cours</div><div className="mt-1 text-2xl font-semibold">{d.present.length}</div></Card>
        <Card><div className="text-xs text-muted-foreground">À venir</div><div className="mt-1 text-2xl font-semibold">{d.upcoming.length}</div></Card>
        <Card><div className="text-xs text-muted-foreground">Complétés</div><div className="mt-1 text-2xl font-semibold">{d.completed.length}</div></Card>
        <Card>
          <div className="text-xs text-muted-foreground">Mes gains ({earnings.data?.sharePercent ?? 25} % des cours payants)</div>
          <div className="mt-1 text-2xl font-semibold">{fmtMGA(earnings.data?.pending ?? 0)}</div>
          <div className="text-xs text-muted-foreground">à verser · {fmtMGA(earnings.data?.paid ?? 0)} déjà versés</div>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold">Mes matières</h2>
        <p className="text-xs text-muted-foreground">Matières que l'administration ou le Responsable pédagogique vous a attribuées.</p>
        {(d.subjects ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Aucune matière ne vous est encore attribuée.</p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(d.subjects ?? []).map((s) => (
              <div key={s.id} className="flex items-start gap-3 rounded-xl border p-3">
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-classroom" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.code}{s.mention ? ` · ${s.mention.name}` : ""} · {s.credits} crédits{s.groups.length ? ` · ${s.groups.join(", ")}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {s.types.map((t) => <span key={t} className="rounded-md border px-1.5 py-0.5 text-[10px] font-bold">{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {d.assignments.length > 0 && (
        <Card>
          <h2 className="font-semibold">Cours qui vous sont attribués — à créer</h2>
          <p className="text-xs text-muted-foreground">Le Responsable de mention vous a confié ces cours du cursus.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {d.assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl border p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.mention.name} · {cursusPlace(a.level, a.month)} · {a.plannedHours} h</div>
                </div>
                <button onClick={() => setCreating(a)} className={btnPrimary}><Plus className="h-4 w-4" /> Créer</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { v: "PRESENT", label: "En cours", count: d.present.length },
          { v: "UPCOMING", label: "À venir", count: d.upcoming.length },
          { v: "COMPLETED", label: "Complétés", count: d.completed.length },
        ]}
      />

      {list.length === 0 ? (
        <Empty>Aucun cours dans cette catégorie.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((c) => <TeacherCourseCard key={c.id} c={c} />)}
        </div>
      )}

      {(creating || newCourse) && (
        <NewCourseDialog assignments={d.assignments} initial={creating} onClose={() => { setCreating(null); setNewCourse(false); }} />
      )}
    </div>
  );
}

function TeacherCourseCard({ c }: { c: CursusCourse }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{c.title}</h3>
            <CourseStatusBadge status={c.progress.status} />
          </div>
          <p className="text-xs text-muted-foreground">
            {cursusPlace(c.cursusLevel, c.cursusMonth)} · {c.enrollments} étudiant{c.enrollments > 1 ? "s" : ""}
            {c.status !== "PUBLISHED" && " · brouillon (non publié)"}
          </p>
        </div>
        <Link to="/online/studio/$id" params={{ id: c.id }} className={btnGhost}><Pencil className="h-3.5 w-3.5" /> Studio</Link>
      </div>
      <div className="mt-4"><HoursSummary p={c.progress} /></div>
      <button onClick={() => setOpen((v) => !v)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-classroom hover:underline">
        <ListChecks className="h-3.5 w-3.5" /> {open ? "Masquer" : "Gérer"} le syllabus détaillé ({c.syllabus.length})
      </button>
      {open && <SyllabusEditor course={c} />}
    </Card>
  );
}

// Le prof rédige le syllabus ; la secrétaire coche chaque point à la fin du cours.
function SyllabusEditor({ course }: { course: CursusCourse }) {
  const m = useSyllabusMutations(course.id);
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState(2);
  const items = course.syllabus;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await m.add.mutateAsync({ title: title.trim(), plannedHours: hours });
      setTitle("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Ajout impossible");
    }
  }
  function move(i: number, dir: -1 | 1) {
    const ids = items.map((x) => x.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    m.reorder.mutate(ids);
  }

  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      {items.length === 0 && <p className="text-xs italic text-muted-foreground">Aucun point : décrivez le contenu de chaque séance.</p>}
      {items.map((it, i) => (
        <div key={it.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          {it.isDone ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className={`flex-1 ${it.isDone ? "text-muted-foreground line-through" : ""}`}>{i + 1}. {it.title}</span>
          <span className="text-xs text-muted-foreground">{it.plannedHours} h</span>
          <button onClick={() => move(i, -1)} className="rounded p-1 hover:bg-accent" title="Monter"><ArrowUp className="h-3.5 w-3.5" /></button>
          <button onClick={() => move(i, 1)} className="rounded p-1 hover:bg-accent" title="Descendre"><ArrowDown className="h-3.5 w-3.5" /></button>
          {!it.isDone && (
            <button onClick={() => m.remove.mutate(it.id)} className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950" title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
          )}
        </div>
      ))}
      <form onSubmit={add} className="flex flex-wrap items-center gap-2">
        <input className={`${inputCls} min-w-0 flex-1`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : Chapitre 3 — Les boucles" />
        <input type="number" min={0.5} step={0.5} className={`${inputCls} w-20`} value={hours} onChange={(e) => setHours(Number(e.target.value))} title="Heures prévues" />
        <button className={btnPrimary} disabled={m.add.isPending}><Plus className="h-4 w-4" /> Ajouter</button>
      </form>
      <p className="text-[11px] text-muted-foreground">Les points cochés par le secrétariat à la fin de chaque cours font avancer la progression (visible par les parents).</p>
    </div>
  );
}

// Création d'un cours : universitaire (cursus, débloqué par l'écolage), certifiant
// (vendu en ligne, prix fixé par le Super Admin) ou les deux.
type Kind = "UNIVERSITY" | "CERTIFYING" | "BOTH";
const KINDS: { v: Kind; label: string; desc: string }[] = [
  { v: "UNIVERSITY", label: "Cours universitaire", desc: "Fait partie du cursus (L1, L2…) : accessible aux étudiants via l'écolage." },
  { v: "CERTIFYING", label: "Cours certifiant", desc: "Vendu en ligne à tout public, avec certificat. Prix fixé par le Super Admin." },
  { v: "BOTH", label: "Les deux", desc: "Dans le cursus pour les étudiants ET vendu en ligne aux autres." },
];

function NewCourseDialog({ assignments, initial, onClose }: { assignments: Assignment[]; initial?: Assignment | null; onClose: () => void }) {
  const navigate = useNavigate();
  const mentions = useQuery({ queryKey: ["cursus", "mentions"], queryFn: () => api<{ id: string; name: string }[]>("/cursus/mentions") });
  const [kind, setKind] = useState<Kind>(initial ? "UNIVERSITY" : "CERTIFYING");
  const [assignmentId, setAssignmentId] = useState(initial?.id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [mentionId, setMentionId] = useState("");
  const [level, setLevel] = useState("L1");
  const [month, setMonth] = useState(1);
  const [credential, setCredential] = useState<"CERTIFICATE" | "ATTESTATION">("CERTIFICATE");
  const [pending, setPending] = useState(false);
  const inCursus = kind !== "CERTIFYING";
  const assignment = assignments.find((a) => a.id === assignmentId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inCursus && !assignment && !mentionId) { toast.error("Choisissez le cours attribué ou la mention / niveau / mois"); return; }
    setPending(true);
    try {
      const body: Record<string, unknown> = { title: title.trim(), courseKind: kind };
      if (kind !== "UNIVERSITY") body.credentialType = credential;
      if (inCursus) {
        if (assignment) body.curriculumEntryId = assignment.id;
        else Object.assign(body, { mentionId, cursusLevel: level, cursusMonth: month });
      }
      const c = await api<{ id: string }>("/online/courses", { method: "POST", body });
      toast.success("Cours créé : ajoutez les modules, leçons et fichiers (Word, PDF, vidéo…) dans le studio.");
      navigate({ to: "/online/studio/$id", params: { id: c.id } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Création impossible");
    } finally { setPending(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Nouveau cours</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Type de cours</p>
          {KINDS.map((k) => (
            <button key={k.v} type="button" onClick={() => setKind(k.v)}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${kind === k.v ? "border-classroom bg-classroom/5" : "hover:bg-accent"}`}>
              <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${kind === k.v ? "border-classroom bg-classroom" : ""}`} />
              <span><span className="block text-sm font-medium">{k.label}</span><span className="block text-xs text-muted-foreground">{k.desc}</span></span>
            </button>
          ))}
        </div>

        {inCursus && (
          <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">Place dans le cursus</p>
            {assignments.length > 0 && (
              <select className={`${inputCls} w-full`} value={assignmentId}
                onChange={(e) => { setAssignmentId(e.target.value); const a = assignments.find((x) => x.id === e.target.value); if (a && !title) setTitle(a.title); }}>
                <option value="">— Autre (choisir mention, niveau, mois) —</option>
                {assignments.map((a) => <option key={a.id} value={a.id}>{a.title} · {a.mention.name} {cursusPlace(a.level, a.month)}</option>)}
              </select>
            )}
            {!assignment && (
              <div className="grid grid-cols-3 gap-2">
                <select className={inputCls} value={mentionId} onChange={(e) => setMentionId(e.target.value)}>
                  <option value="">Mention…</option>
                  {(mentions.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value)}>
                  {["L1", "L2", "L3", "M1", "M2"].map((l) => <option key={l}>{l}</option>)}
                </select>
                <select className={inputCls} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((m) => <option key={m} value={m}>Mois {m}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        <label className="block text-xs text-muted-foreground">Titre du cours
          <input className={`${inputCls} mt-1 w-full`} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} placeholder="Ex : Java I — Les bases" />
        </label>

        {kind !== "UNIVERSITY" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">Document délivré
              <select className={`${inputCls} mt-1 w-full`} value={credential} onChange={(e) => setCredential(e.target.value as "CERTIFICATE" | "ATTESTATION")}>
                <option value="CERTIFICATE">Certificat</option>
                <option value="ATTESTATION">Attestation</option>
              </select>
            </label>
            <p className="self-end text-xs text-muted-foreground">Le prix de vente est fixé par le Super Admin.</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">Après la création, ajoutez un ou plusieurs fichiers par leçon (Word, PDF, vidéo, audio…) dans le studio.</p>
        <button type="submit" disabled={pending} className={`${btnPrimary} w-full justify-center`}>
          <Plus className="h-4 w-4" /> Créer le cours
        </button>
      </form>
    </div>
  );
}
