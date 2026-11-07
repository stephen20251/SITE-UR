import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Users, Star, GraduationCap, Loader2, Play } from "lucide-react";
import { useInstructorProfile, type CourseCard } from "@/lib/online";
import { OnlineNavbar, initials } from "@/components/online/shared";
import { RatingBadge } from "@/components/online/engagement";

export const Route = createFileRoute("/online/instructor/$id")({
  head: () => ({ meta: [{ title: "Instructeur — UR Online" }] }),
  component: InstructorPage,
});

const API_BASE = "http://localhost:4000";
function mediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

function InstructorPage() {
  const { id } = Route.useParams();
  const { data, isLoading, isError } = useInstructorProfile(id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <OnlineNavbar />
        <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="min-h-screen bg-background">
        <OnlineNavbar />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-muted-foreground">Instructeur introuvable.</p>
          <Link to="/online" className="mt-3 inline-block text-sm font-medium text-online hover:underline">← Catalogue</Link>
        </div>
      </div>
    );
  }

  const { teacher, stats, courses } = data;
  const memberSince = new Date(teacher.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-background">
      <OnlineNavbar />

      {/* Hero */}
      <div className="border-b bg-gradient-to-br from-slate-900 to-purple-950">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
            <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-3xl font-extrabold text-white shadow-2xl ring-4 ring-white/20">
              {teacher.avatarUrl
                ? <img src={mediaUrl(teacher.avatarUrl)} alt="" className="h-full w-full object-cover" />
                : initials(teacher.firstName, teacher.lastName)}
            </div>
            <div className="flex-1 text-white">
              <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-0.5 text-xs font-medium text-white/80">
                <GraduationCap className="h-3 w-3 text-violet-300" /> Instructeur
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                {teacher.firstName} {teacher.lastName}
              </h1>
              <div className="mt-0.5 text-sm text-white/60">Membre depuis {memberSince}</div>

              <div className="mt-4 flex flex-wrap justify-center gap-5 sm:justify-start">
                {[
                  { label: "Cours publiés", value: stats.courses, icon: BookOpen },
                  { label: "Étudiants", value: stats.students, icon: Users },
                  { label: "Note moyenne", value: stats.avgRating ? stats.avgRating.toFixed(1) : "—", icon: Star },
                  { label: "Avis", value: stats.reviews, icon: Star },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="text-center sm:text-left">
                    <div className="flex items-center gap-1.5 text-lg font-bold text-white">
                      <Icon className="h-4 w-4 text-violet-400" /> {value}
                    </div>
                    <div className="text-xs text-white/50">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Courses */}
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h2 className="mb-4 font-semibold tracking-tight">
          Cours de {teacher.firstName} <span className="text-muted-foreground">({courses.length})</span>
        </h2>
        {courses.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Aucun cours publié pour l'instant.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => <InstructorCourseTile key={c.id} c={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function InstructorCourseTile({ c }: { c: CourseCard }) {
  return (
    <Link
      to="/online/course/$id"
      params={{ id: c.id }}
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-elegant transition-all hover:-translate-y-1 hover:shadow-glow"
    >
      <div className="relative aspect-[16/9] overflow-hidden grad-online">
        {c.thumbnail ? (
          <img src={mediaUrl(c.thumbnail)} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center"><Play className="h-10 w-10 text-white/60" /></div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="line-clamp-2 flex-1 text-sm font-semibold leading-snug">{c.title}</div>
        <div className="mt-2 flex items-center gap-2.5 text-xs text-muted-foreground">
          {(c.ratingCount ?? 0) > 0 && <RatingBadge avg={c.ratingAvg} count={c.ratingCount} className="text-foreground" />}
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {c._count.enrollments}</span>
          <span className="ml-auto font-semibold text-foreground">{(c.price ?? 0) > 0 ? `${c.price} MGA` : "Gratuit"}</span>
        </div>
      </div>
    </Link>
  );
}
