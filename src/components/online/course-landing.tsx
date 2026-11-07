// Page de présentation d'un cours, façon MOOC (Coursera) : bandeau d'inscription,
// informations clés, objectifs, programme par module, enseignant, certificat.
// Affichée aux visiteurs et à toute personne pas encore inscrite au cours.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Award, BookOpen, CheckCircle2, ChevronDown, Clock, FileQuestion, Globe, GraduationCap, Loader2,
  Lock, PlayCircle, ShieldCheck, Signal, Star, Users,
} from "lucide-react";
import type { CourseDetail } from "@/lib/online";
import { cursusPlace } from "@/lib/cursus";
import { usePublicMentions } from "@/lib/candidatures";
import { CourseCover, DIFFICULTY, UrMark, mediaUrl } from "@/components/online/mooc-card";
import { CANDIDATE_URL } from "@/components/online/cursus-online";

const LANG: Record<string, string> = { fr: "Français", en: "Anglais", mg: "Malgache" };

function fmtDuration(sec: number) {
  if (!sec) return null;
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

export type LandingActions = {
  guest: boolean;
  pending: boolean;
  hasPendingPayment: boolean;
  onEnroll: () => void;
  onPay: () => void;
  onPreview: (lessonId: string) => void;
};

export function CourseLanding({ course, actions }: { course: CourseDetail; actions: LandingActions }) {
  const { data: mentions = [] } = usePublicMentions();
  const [open, setOpen] = useState<Record<string, boolean>>({ [course.modules[0]?.id ?? ""]: true });

  const lessons = course.modules.flatMap((m) => m.lessons);
  const totalSec = lessons.reduce((s, l) => s + (l.duration ?? 0), 0);
  const hours = course.estimatedHours ?? course.totalHours ?? (totalSec ? Math.round(totalSec / 360) / 10 : null);
  const inCursus = course.courseKind === "UNIVERSITY" || course.courseKind === "BOTH";
  const doc = course.credentialType === "ATTESTATION" ? "Attestation" : "Certificat";
  const mention = mentions.find((m) => m.id === course.mentionId)?.name;
  const firstPreview = lessons.find((l) => !l.locked);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Bandeau ── */}
      <section className="border-b bg-gradient-to-br from-sky-50 via-white to-violet-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
          <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Link to="/online" className="hover:text-foreground hover:underline">Catalogue</Link>
            <span>›</span>
            <span>{inCursus ? `Cursus universitaire${mention ? ` · ${mention}` : ""}` : course.category?.name ?? "Cours certifiants"}</span>
          </nav>
          <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><UrMark size={22} /> Université Références</div>
              <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{course.title}</h1>
              {course.subtitle && <p className="mt-2 text-lg text-muted-foreground">{course.subtitle}</p>}
              {inCursus && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-online/10 px-3 py-1 text-xs font-semibold text-online">
                  <GraduationCap className="h-3.5 w-3.5" /> Cursus {cursusPlace(course.cursusLevel, course.cursusMonth)}
                </div>
              )}
              <p className="mt-4 text-sm">
                Enseignant :{" "}
                <Link to="/online/instructor/$id" params={{ id: course.teacher.id ?? "" }} className="font-semibold text-online hover:underline">
                  {course.teacher.firstName} {course.teacher.lastName}
                </Link>
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <EnrollCta course={course} actions={actions} />
                <span className="text-sm text-muted-foreground">
                  <b className="text-foreground">{course.enrollmentsCount.toLocaleString("fr-FR")}</b> déjà inscrit{course.enrollmentsCount > 1 ? "s" : ""}
                </span>
              </div>
              {firstPreview && !actions.guest && (
                <button onClick={() => actions.onPreview(firstPreview.id)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-online hover:underline">
                  <PlayCircle className="h-4 w-4" /> Voir un aperçu gratuit
                </button>
              )}
            </div>

            <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-lg lg:block">
              <div className="aspect-video"><CourseCover id={course.id} title={course.title} thumbnail={course.thumbnail} /></div>
              <ul className="space-y-2.5 p-5 text-sm">
                <li className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-muted-foreground" /> {course.modules.length} modules · {lessons.length} leçons</li>
                {course.quizzes.length > 0 && <li className="flex items-center gap-2"><FileQuestion className="h-4 w-4 text-muted-foreground" /> {course.quizzes.length} test{course.quizzes.length > 1 ? "s" : ""} d'évaluation</li>}
                <li className="flex items-center gap-2"><Award className="h-4 w-4 text-muted-foreground" /> {course.courseKind === "UNIVERSITY" ? "Compte pour le diplôme UR" : `${doc} partageable`}</li>
                {course.protectedContent && <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground" /> Consultation en ligne uniquement</li>}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Informations clés ── */}
      <div className="mx-auto -mt-px max-w-6xl px-4 sm:px-6">
        <div className="relative z-10 -translate-y-1/2 grid grid-cols-2 divide-x divide-y rounded-xl border bg-card shadow-md sm:grid-cols-4 sm:divide-y-0">
          <KeyFact Icon={Star} title={course.ratingCount > 0 ? `${course.ratingAvg.toFixed(1)} ★` : "Nouveau"} sub={course.ratingCount > 0 ? `${course.ratingCount} avis` : "Pas encore d'avis"} />
          <KeyFact Icon={Signal} title={course.level ? DIFFICULTY[course.level] ?? course.level : "Tous niveaux"} sub="Niveau" />
          <KeyFact Icon={Clock} title={hours ? `${hours} h` : "À votre rythme"} sub="Rythme libre" />
          <KeyFact Icon={Globe} title={LANG[course.language ?? "fr"] ?? course.language ?? "Français"} sub="Langue" />
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-10">
          {/* À propos */}
          <section>
            <h2 className="text-xl font-bold">À propos de ce cours</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {course.description || "L'enseignant n'a pas encore rédigé de description."}
            </p>
          </section>

          {course.objectives.length > 0 && (
            <section className="rounded-xl border p-6">
              <h2 className="text-xl font-bold">Ce que vous allez apprendre</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {course.objectives.map((o) => (
                  <li key={o} className="flex items-start gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{o}</li>
                ))}
              </ul>
            </section>
          )}

          {(course.skills.length > 0 || course.tags.length > 0) && (
            <section>
              <h2 className="text-xl font-bold">Compétences que vous acquerrez</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(course.skills.length ? course.skills : course.tags).map((s) => (
                  <span key={s} className="rounded-full border bg-muted/40 px-3 py-1 text-sm">{s}</span>
                ))}
              </div>
            </section>
          )}

          {/* Programme */}
          <section>
            <h2 className="text-xl font-bold">Programme du cours</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {course.modules.length} modules · {lessons.length} leçons{totalSec ? ` · ${fmtDuration(totalSec)} de contenu` : ""}
            </p>
            <div className="mt-4 divide-y overflow-hidden rounded-xl border">
              {course.modules.map((m, i) => {
                const isOpen = open[m.id];
                const dur = fmtDuration(m.lessons.reduce((s, l) => s + (l.duration ?? 0), 0));
                return (
                  <div key={m.id}>
                    <button onClick={() => setOpen((o) => ({ ...o, [m.id]: !o[m.id] }))}
                      className="flex w-full items-center gap-3 bg-card px-5 py-4 text-left hover:bg-accent/50">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Module {i + 1}</span>
                      <span className="flex-1 font-semibold">{m.title}</span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">{m.lessons.length} leçon{m.lessons.length > 1 ? "s" : ""}{dur ? ` · ${dur}` : ""}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <ul className="space-y-1 bg-muted/20 px-5 py-3">
                        {m.description && <li className="pb-2 text-sm text-muted-foreground">{m.description}</li>}
                        {m.lessons.map((l) => (
                          <li key={l.id} className="flex items-center gap-2 py-1.5 text-sm">
                            {l.locked ? <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <PlayCircle className="h-3.5 w-3.5 shrink-0 text-online" />}
                            <span className="flex-1">{l.title}</span>
                            {!l.locked && !actions.guest && (
                              <button onClick={() => actions.onPreview(l.id)} className="text-xs font-medium text-online hover:underline">Aperçu</button>
                            )}
                            {l.duration ? <span className="text-xs text-muted-foreground">{fmtDuration(l.duration)}</span> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {(course.prerequisites || course.audience) && (
            <section className="grid gap-6 sm:grid-cols-2">
              {course.prerequisites && (
                <div><h3 className="font-semibold">Prérequis</h3><p className="mt-1 text-sm text-muted-foreground">{course.prerequisites}</p></div>
              )}
              {course.audience && (
                <div><h3 className="font-semibold">À qui s'adresse ce cours ?</h3><p className="mt-1 text-sm text-muted-foreground">{course.audience}</p></div>
              )}
            </section>
          )}

          {/* Enseignant */}
          <section>
            <h2 className="text-xl font-bold">Enseignant</h2>
            <Link to="/online/instructor/$id" params={{ id: course.teacher.id ?? "" }}
              className="mt-4 flex items-center gap-4 rounded-xl border p-5 transition hover:shadow-md">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-online/10 text-lg font-bold text-online">
                {course.teacher.avatarUrl
                  ? <img src={mediaUrl(course.teacher.avatarUrl)} alt="" className="h-full w-full object-cover" />
                  : `${course.teacher.firstName[0] ?? ""}${course.teacher.lastName[0] ?? ""}`}
              </div>
              <div>
                <div className="font-semibold text-online">{course.teacher.firstName} {course.teacher.lastName}</div>
                <div className="text-sm text-muted-foreground">Enseignant(e) à l'Université Références</div>
              </div>
            </Link>
          </section>
        </div>

        {/* Colonne : document délivré */}
        <aside className="space-y-4">
          {course.courseKind === "UNIVERSITY" ? (
          <div className="rounded-xl border p-5">
            <GraduationCap className="h-8 w-8 text-online" />
            <h3 className="mt-2 font-semibold">Compte pour le diplôme de l'UR</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Ce cours fait partie du cursus {cursusPlace(course.cursusLevel, course.cursusMonth)}. Il est réservé aux étudiants de
              l'Université Références et inclus dans leur écolage mensuel.
            </p>
            <a href={CANDIDATE_URL} className="mt-3 inline-block text-sm font-semibold text-online hover:underline">Devenir étudiant(e) de l'UR →</a>
          </div>
          ) : (
          <div className="rounded-xl border p-5">
            <Award className="h-8 w-8 text-amber-500" />
            <h3 className="mt-2 font-semibold">{doc} à partager</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Terminez les leçons et réussissez le test final pour obtenir {doc === "Attestation" ? "une attestation" : "un certificat"} vérifiable en ligne, à ajouter à votre CV.
            </p>
            {inCursus && (
              <p className="mt-3 rounded-lg bg-online/5 p-3 text-xs text-muted-foreground">
                <b className="text-foreground">Étudiant(e) de l'UR ?</b> Ce cours fait partie du cursus {cursusPlace(course.cursusLevel, course.cursusMonth)} : il est inclus dans votre écolage et compte pour votre diplôme.
              </p>
            )}
          </div>
          )}
          <div className="rounded-xl border p-5 text-sm">
            <div className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> {course.enrollmentsCount.toLocaleString("fr-FR")} apprenants</div>
            <p className="mt-1 text-muted-foreground">Rejoignez-les et apprenez à votre rythme, sur ordinateur ou mobile.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function KeyFact({ Icon, title, sub }: { Icon: React.ComponentType<{ className?: string }>; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <Icon className="h-5 w-5 shrink-0 text-online" />
      <div><div className="font-semibold leading-tight">{title}</div><div className="text-xs text-muted-foreground">{sub}</div></div>
    </div>
  );
}

// Bouton d'inscription selon la situation (visiteur, gratuit, payant, cursus…).
function EnrollCta({ course, actions }: { course: CourseDetail; actions: LandingActions }) {
  const btn = "inline-flex items-center gap-2 rounded-lg bg-online px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60";
  const reason = course.cursus?.reason;
  // Cursus universitaire : les non-étudiants le consultent, ils candidatent pour y accéder.
  if (course.courseKind === "UNIVERSITY" && (actions.guest || reason === "not_student")) {
    return (
      <div className="flex flex-col gap-1.5">
        <a href={CANDIDATE_URL} className={btn}><GraduationCap className="h-4 w-4" /> Devenir étudiant(e) de l'UR</a>
        <span className="text-xs text-muted-foreground">Cours réservé aux étudiants de l'UR · déposez votre candidature pour y accéder</span>
      </div>
    );
  }
  if (actions.guest) {
    return (
      <div className="flex flex-col gap-1.5">
        <Link to="/online/register" className={btn}>S'inscrire gratuitement</Link>
        <span className="text-xs text-muted-foreground">Déjà un compte ? <Link to="/online/login" className="text-online hover:underline">Se connecter</Link></span>
      </div>
    );
  }
  // Étudiant UR, cours de son propre cursus pas encore débloqué.
  if (course.cursus && !course.cursus.accessible) {
    if (reason === "not_in_cursus") {
      return (
        <span className="inline-flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" /> Non accessible · ce cours appartient à un autre niveau du cursus
        </span>
      );
    }
    const msg = reason === "related_incomplete"
      ? "Non accessible : terminez d'abord les cours liés de votre cursus."
      : `Non accessible : réglez l'écolage du mois ${course.cursus.month ?? ""} pour le débloquer.`;
    return (
      <div className="flex flex-col gap-1.5">
        <Link to="/classroom/cursus" className={btn}><Lock className="h-4 w-4" /> Voir mon cursus et l'écolage</Link>
        <span className="text-xs text-muted-foreground">{msg}</span>
      </div>
    );
  }
  if ((course.price ?? 0) > 0) {
    if (actions.hasPendingPayment) {
      return <span className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">Paiement envoyé — en attente de validation</span>;
    }
    return (
      <div className="flex flex-col gap-1.5">
        <button onClick={actions.onPay} className={btn}>S'inscrire — {(course.price ?? 0).toLocaleString("fr-FR")} MGA</button>
        <span className="text-xs text-muted-foreground">MVola · Orange Money · Airtel Money</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <button onClick={actions.onEnroll} disabled={actions.pending} className={btn}>
        {actions.pending && <Loader2 className="h-4 w-4 animate-spin" />} S'inscrire gratuitement
      </button>
      <span className="text-xs text-muted-foreground">Accès immédiat · {course.credentialType === "ATTESTATION" ? "attestation" : "certificat"} inclus</span>
    </div>
  );
}
