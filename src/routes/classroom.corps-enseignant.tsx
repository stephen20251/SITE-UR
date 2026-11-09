import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Award, BookOpen, Briefcase, FileText, GraduationCap } from "lucide-react";
import { ApiError } from "@/lib/api";
import { openCv, titleLabel, useFaculty, type AcademicTitle, type FacultyMember } from "@/lib/faculty";
import { useRequireClassroom } from "@/components/classroom/shared";
import { Card, Empty, Loading, PageHeader } from "@/components/classroom/cursus-ui";

export const Route = createFileRoute("/classroom/corps-enseignant")({ component: FacultyPage });

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const FILES_BASE = API_URL.replace(/\/api\/?$/, "");
const photoUrl = (url: string | null) => (url ? (url.startsWith("http") ? url : `${FILES_BASE}${url}`) : null);

type TitleFilter = "ALL" | AcademicTitle;

function FacultyPage() {
  const { user, ready } = useRequireClassroom(["STUDENT", "PARENT", "SUPER_ADMIN"]);
  const faculty = useFaculty(ready && !!user);
  const [title, setTitle] = useState<TitleFilter>("ALL");
  const [mentionId, setMentionId] = useState("");

  const members = faculty.data ?? [];
  const mentions = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of members) if (t.mention) m.set(t.mention.id, t.mention.name);
    return [...m].sort((a, b) => a[1].localeCompare(b[1], "fr"));
  }, [members]);
  const professors = members.filter((t) => t.academicTitle === "PROFESSEUR").length;
  const doctors = members.length - professors;
  const shown = members.filter((t) => (title === "ALL" || t.academicTitle === title) && (!mentionId || t.mention?.id === mentionId));

  if (!ready || !user) return <Loading />;
  if (faculty.error) {
    const denied = faculty.error instanceof ApiError && faculty.error.status === 403;
    return (
      <div className="space-y-6">
        <PageHeader title="Corps enseignant" />
        <Card><Empty>{denied ? faculty.error.message : "Impossible de charger le corps enseignant."}</Empty></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Corps enseignant"
        subtitle="Les professeurs et docteurs qui enseignent à l'Université Références : titres, parcours et CV."
      />
      {faculty.isLoading ? <Loading /> : members.length === 0 ? (
        <Card><Empty>Les dossiers des enseignants sont en cours de publication.</Empty></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <Card><div className="text-3xl font-bold text-classroom">{professors}</div><div className="text-xs text-muted-foreground">Professeur{professors > 1 ? "s" : ""}</div></Card>
            <Card><div className="text-3xl font-bold text-classroom">{doctors}</div><div className="text-xs text-muted-foreground">Docteur{doctors > 1 ? "s" : ""}</div></Card>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {([["ALL", "Tous"], ["PROFESSEUR", "Professeurs"], ["DOCTEUR", "Docteurs"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setTitle(v)} aria-pressed={title === v}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${title === v ? "border-classroom bg-classroom text-white" : "hover:bg-accent"}`}>
                {label}
              </button>
            ))}
            {mentions.length > 1 && (
              <select value={mentionId} onChange={(e) => setMentionId(e.target.value)} aria-label="Filtrer par mention"
                className="ml-auto h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
                <option value="">Toutes les mentions</option>
                {mentions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            )}
          </div>

          {shown.length === 0
            ? <Card><Empty>Aucun enseignant ne correspond à ces filtres.</Empty></Card>
            : <div className="grid gap-4 lg:grid-cols-2">{shown.map((t) => <MemberCard key={t.id} t={t} />)}</div>}
        </>
      )}
    </div>
  );
}

function MemberCard({ t }: { t: FacultyMember }) {
  const photo = photoUrl(t.avatarUrl);
  const initials = `${t.firstName[0] ?? ""}${t.lastName[0] ?? ""}`.toUpperCase();
  async function viewCv() {
    try {
      await openCv(`/faculty/${t.id}/cv`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible d'ouvrir le CV");
    }
  }
  return (
    <article className="flex flex-col rounded-2xl border bg-card p-5 shadow-elegant">
      <div className="flex items-start gap-4">
        {photo
          ? <img src={photo} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
          : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl grad-classroom text-lg font-bold text-white">{initials}</div>}
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-classroom/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-classroom">
            <Award size={11} /> {titleLabel(t.academicTitle)}
          </span>
          <h2 className="mt-1 text-lg font-semibold leading-snug">{t.firstName} {t.lastName}</h2>
          {t.specialization && <p className="text-sm text-muted-foreground">{t.specialization}</p>}
        </div>
      </div>
      <ul className="mt-4 space-y-1.5 text-sm">
        {t.highestDegree && <li className="flex items-start gap-2"><GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> {t.highestDegree}</li>}
        {t.yearsExperience != null && (
          <li className="flex items-start gap-2"><Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> {t.yearsExperience} an{t.yearsExperience > 1 ? "s" : ""} d'expérience</li>
        )}
        {t.mention && <li className="flex items-start gap-2"><BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> Mention {t.mention.name}</li>}
      </ul>
      {t.bio && <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{t.bio}</p>}
      {t.courses.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground">Cours enseignés</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {t.courses.map((c) => <span key={c.id} className="rounded-lg bg-muted px-2 py-0.5 text-xs">{c.title}</span>)}
          </div>
        </div>
      )}
      <div className="mt-auto pt-4">
        <button onClick={viewCv} className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent">
          <FileText className="h-4 w-4" /> Consulter le CV (PDF)
        </button>
      </div>
    </article>
  );
}
