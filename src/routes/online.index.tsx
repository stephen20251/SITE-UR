import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Award, ChevronRight, Star, GraduationCap, ShieldCheck, Smartphone, BadgeCheck,
  UserPlus, MonitorPlay, Medal, Quote, Clock, SlidersHorizontal, X, BookOpen, Layers,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { isHybridUser, OnlineNavbar, initials } from "@/components/online/shared";
import {
  usePublicCourses, usePublicStats, useCourses, useWishlistIds, useToggleWishlist,
  usePublicReviewHighlights, useFeaturedInstructors,
  type CatalogueFilters, type CatalogueSort, type CourseCard,
} from "@/lib/online";
import { usePublicSettings, usePublicCategories } from "@/lib/lms-admin";
import { usePublicMentions } from "@/lib/candidatures";
import { LEVELS, semesterLabel, semesterOf } from "@/lib/cursus";
import { MoocCard, MoocCardSkeleton, UrMark, mediaUrl } from "@/components/online/mooc-card";
import { BecomeStudentBanner, CursusMonthsCatalog, useCursusAccess } from "@/components/online/cursus-online";

export const Route = createFileRoute("/online/")({
  head: () => ({ meta: [{ title: "UR Online — Cours en ligne de l'Université Références" }] }),
  component: OnlineHome,
});

type Kind = "ALL" | "CERTIFYING" | "UNIVERSITY";
const LEVEL_NAMES: Record<string, string> = {
  L1: "Licence 1", L2: "Licence 2", L3: "Licence 3", M1: "Master 1", M2: "Master 2",
};

// Catalogue public (visiteur) ou connecté, mêmes filtres.
function useCatalog(f: CatalogueFilters, authed: boolean) {
  const pub = usePublicCourses(f, { enabled: !authed });
  const priv = useCourses(f, { enabled: authed });
  return authed ? priv : pub;
}

function scrollToCatalogue() {
  document.getElementById("catalogue")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function OnlineHome() {
  const { user, ready } = useAuth();
  const { data: settings } = usePublicSettings();
  const { data: categories = [] } = usePublicCategories();
  const { data: mentions = [] } = usePublicMentions();
  const stats = usePublicStats();
  const { data: highlights = [] } = usePublicReviewHighlights();
  const { data: instructors = [] } = useFeaturedInstructors();

  const hybrid = isHybridUser(user);
  const authed = ready && !!user && (user.system === "ONLINE" || hybrid || user.systemRole === "SUPER_ADMIN");
  const isUnivStudent = user?.systemRole === "STUDENT";

  // ── Filtres du catalogue ──
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [kind, setKind] = useState<Kind>("ALL");
  const [categoryId, setCategoryId] = useState("");
  const [mentionId, setMentionId] = useState("");
  const [cursusLevel, setCursusLevel] = useState("");
  const [semester, setSemester] = useState<0 | 1 | 2>(0);
  const [level, setLevel] = useState<"" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED">("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<CatalogueSort>("popular");
  const [limit, setLimit] = useState(24);
  const [showFilters, setShowFilters] = useState(false);

  const filters: CatalogueFilters = {
    kind,
    q: submitted || undefined,
    sort,
    categoryId: categoryId || undefined,
    mentionId: kind === "UNIVERSITY" ? mentionId || undefined : undefined,
    cursusLevel: kind === "UNIVERSITY" ? cursusLevel || undefined : undefined,
    level: level || undefined,
    free: freeOnly || undefined,
    minRating: minRating || undefined,
    limit,
  };
  const catalog = useCatalog(filters, authed);
  const popular = useCatalog({ kind: "ALL", sort: "popular", limit: 4 }, authed);
  const programsQ = useCatalog({ kind: "UNIVERSITY", limit: 48 }, authed);

  // Accès aux cours du cursus (étudiant à jour / mois non payé / non-étudiant).
  const access = useCursusAccess();
  // Un étudiant arrive par défaut sur le cursus de sa mention et de son niveau.
  const defaulted = useRef(false);
  useEffect(() => {
    const st = access.overview?.student;
    if (kind !== "UNIVERSITY" || defaulted.current || !st?.level) return;
    defaulted.current = true;
    setCursusLevel(st.level);
    setMentionId(st.mention?.id ?? "");
  }, [kind, access.overview]);

  const wishlistIds = useWishlistIds({ enabled: authed });
  const toggleWishlist = useToggleWishlist();
  const wishSet = new Set(wishlistIds.data ?? []);

  const results = (catalog.data?.items ?? []).filter(
    (c) => !semester || (c.cursusMonth != null && semesterOf(c.cursusMonth) === semester),
  );

  // Programmes universitaires : un par mention et niveau d'études.
  const mentionName = (id?: string | null) => mentions.find((m) => m.id === id)?.name ?? "Toutes mentions";
  const programs = useMemo(() => {
    const map = new Map<string, { mentionId: string | null; level: string; courses: CourseCard[] }>();
    for (const c of programsQ.data?.items ?? []) {
      if (!c.cursusLevel) continue;
      const key = `${c.mentionId ?? ""}|${c.cursusLevel}`;
      const p = map.get(key) ?? { mentionId: c.mentionId ?? null, level: c.cursusLevel, courses: [] };
      p.courses.push(c);
      map.set(key, p);
    }
    return [...map.values()].sort((a, b) => LEVELS.indexOf(a.level as never) - LEVELS.indexOf(b.level as never));
  }, [programsQ.data]);

  const activeFilters = Boolean(categoryId || mentionId || cursusLevel || semester || level || freeOnly || minRating || submitted);
  function resetFilters() {
    setKind("ALL"); setCategoryId(""); setMentionId(""); setCursusLevel(""); setSemester(0);
    setLevel(""); setFreeOnly(false); setMinRating(0); setSubmitted(""); setQ("");
  }
  function openProgram(p: { mentionId: string | null; level: string }) {
    resetFilters();
    setKind("UNIVERSITY"); setMentionId(p.mentionId ?? ""); setCursusLevel(p.level);
    scrollToCatalogue();
  }

  const flatCats = categories.flatMap((c) => [c, ...(c.children ?? [])]);
  const platformName = settings?.platformName ?? "UR Online";

  return (
    <div className="min-h-screen bg-background">
      <OnlineNavbar />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="border-b bg-gradient-to-br from-sky-50 via-white to-violet-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur dark:bg-white/5">
              <UrMark size={16} /> Proposé par l'Université Références
            </div>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Apprenez sans limites
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              {settings?.platformDescription
                ?? "Suivez les cours de l'université en ligne, à votre rythme : cursus universitaire de la Licence au Master et cours certifiants ouverts à tous."}
            </p>

            <form
              className="mt-7 flex max-w-xl items-center gap-2 rounded-full border bg-background p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-online/30"
              onSubmit={(e) => { e.preventDefault(); setSubmitted(q.trim()); scrollToCatalogue(); }}
            >
              <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Que voulez-vous apprendre ?"
                className="flex-1 bg-transparent px-1 py-2 text-sm outline-none"
              />
              <button type="submit" className="rounded-full bg-online px-5 py-2 text-sm font-semibold text-white hover:opacity-90">
                Rechercher
              </button>
            </form>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {authed ? (
                <Link
                  to={(isUnivStudent ? "/classroom/cursus" : "/online/dashboard") as "/online/dashboard"}
                  className="inline-flex items-center gap-2 rounded-lg bg-online px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
                >
                  Reprendre mon apprentissage <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link to="/online/register" className="inline-flex items-center gap-2 rounded-lg bg-online px-5 py-3 text-sm font-semibold text-white hover:opacity-90">
                  S'inscrire gratuitement <ChevronRight className="h-4 w-4" />
                </Link>
              )}
              <button onClick={scrollToCatalogue} className="rounded-lg border bg-background px-5 py-3 text-sm font-semibold hover:bg-accent">
                Explorer le catalogue
              </button>
            </div>
          </div>

          {/* Visuel */}
          <div className="relative hidden lg:block">
            <div className="overflow-hidden rounded-3xl border bg-card shadow-xl">
              {settings?.bannerUrl ? (
                <img src={mediaUrl(settings.bannerUrl)} alt="" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="grid aspect-[4/3] place-items-center grad-online">
                  <GraduationCap className="h-24 w-24 text-white/80" />
                </div>
              )}
            </div>
            <div className="absolute -bottom-6 -left-6 rounded-2xl border bg-card p-4 shadow-lg">
              <div className="text-2xl font-extrabold">{stats.data?.courses ?? "—"}</div>
              <div className="text-xs text-muted-foreground">cours disponibles</div>
            </div>
            <div className="absolute -right-4 top-8 rounded-2xl border bg-card p-4 shadow-lg">
              <div className="flex items-center gap-2 text-2xl font-extrabold"><Award className="h-5 w-5 text-amber-500" />{stats.data?.certificates ?? "—"}</div>
              <div className="text-xs text-muted-foreground">certificats délivrés</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONFIANCE ────────────────────────────────────────────────── */}
      <section className="border-b bg-card">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-5 text-sm sm:px-6 md:grid-cols-4 lg:px-8">
          {[
            { Icon: GraduationCap, t: "Enseignants de l'université", s: "Les mêmes professeurs qu'en amphi" },
            { Icon: BadgeCheck, t: "Certificats vérifiables", s: "Un code unique contrôlable en ligne" },
            { Icon: Clock, t: "Rythme libre", s: "Commencez quand vous voulez" },
            { Icon: Smartphone, t: "Mobile Money", s: "MVola, Orange Money, Airtel" },
          ].map(({ Icon, t, s }) => (
            <div key={t} className="flex items-start gap-2.5">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-online" />
              <div><div className="font-semibold leading-tight">{t}</div><div className="text-xs text-muted-foreground">{s}</div></div>
            </div>
          ))}
        </div>
      </section>

      {isUnivStudent && (
        <div className="border-b bg-online/5">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6 lg:px-8">
            <span>Étudiant(e) de l'UR : les cours de votre propre cursus se débloquent par l'écolage mensuel.</span>
            <Link to="/classroom/cursus" className="font-semibold text-online hover:underline">Voir mon cursus →</Link>
          </div>
        </div>
      )}

      {/* ── DOMAINES ─────────────────────────────────────────────────── */}
      {flatCats.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight">Explorer par domaine</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {flatCats.slice(0, 12).map((cat) => (
              <button
                key={cat.id}
                onClick={() => { resetFilters(); setCategoryId(cat.id); scrollToCatalogue(); }}
                className="flex flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left transition hover:border-online hover:shadow-md"
              >
                <span className="text-2xl">{cat.icon ?? "📘"}</span>
                <span className="text-sm font-semibold leading-tight">{cat.name}</span>
                <span className="text-xs text-muted-foreground">{cat._count?.courses ?? 0} cours</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── PROGRAMMES UNIVERSITAIRES ────────────────────────────────── */}
      {programs.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Programmes universitaires</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Les cours du cursus de l'UR, de la Licence au Master, présentés mois par mois. Réservés aux étudiants de l'UR : consultez les programmes et candidatez pour y accéder.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((p) => {
              const sems = [...new Set(p.courses.map((c) => semesterOf(c.cursusMonth ?? 1)))].sort();
              const hours = p.courses.reduce((s, c) => s + (c.totalHours ?? c.estimatedHours ?? 0), 0);
              return (
                <button
                  key={`${p.mentionId}-${p.level}`}
                  onClick={() => openProgram(p)}
                  className="group overflow-hidden rounded-xl border bg-card text-left transition hover:shadow-lg"
                >
                  <div className="flex items-center justify-between bg-gradient-to-r from-online to-violet-600 px-5 py-4 text-white">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider opacity-80">{LEVEL_NAMES[p.level] ?? p.level}</div>
                      <div className="text-lg font-bold">{mentionName(p.mentionId)}</div>
                    </div>
                    <GraduationCap className="h-8 w-8 opacity-80" />
                  </div>
                  <div className="space-y-2 p-5 text-sm">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><UrMark size={16} /> Université Références · Programme</div>
                    <div className="flex flex-wrap gap-1.5">
                      {sems.map((s) => (
                        <span key={s} className="rounded-full bg-online/10 px-2.5 py-0.5 text-xs font-semibold text-online">{semesterLabel(p.level, s)}</span>
                      ))}
                    </div>
                    <p className="text-muted-foreground">
                      {p.courses.length} cours{hours ? ` · ${hours} h de formation` : ""}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-online group-hover:underline">
                      Voir les cours <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── LES PLUS POPULAIRES ──────────────────────────────────────── */}
      {!activeFilters && (popular.data?.items.length ?? 0) > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight">Les plus populaires</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {popular.data!.items.map((c) => <MoocCard key={c.id} c={c} status={access.statusOf(c)} />)}
          </div>
        </section>
      )}

      {/* ── CATALOGUE ────────────────────────────────────────────────── */}
      <section id="catalogue" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {submitted ? `Résultats pour « ${submitted} »` : "Catalogue"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {catalog.data?.total ?? 0} résultat{(catalog.data?.total ?? 0) > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm lg:hidden">
              <SlidersHorizontal className="h-4 w-4" /> Filtres
            </button>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as CatalogueSort)}
              className="rounded-lg border bg-background px-3 py-2 text-sm outline-none"
            >
              <option value="popular">Les plus populaires</option>
              <option value="rating">Les mieux notés</option>
              <option value="recent">Les plus récents</option>
            </select>
          </div>
        </div>

        {/* Type de formation */}
        <div className="mt-5 flex flex-wrap gap-2">
          {([
            { v: "ALL", l: "Tout", Icon: Layers },
            { v: "CERTIFYING", l: "Cours certifiants", Icon: Award },
            { v: "UNIVERSITY", l: "Cursus universitaire", Icon: GraduationCap },
          ] as const).map(({ v, l, Icon }) => (
            <button
              key={v}
              onClick={() => { setKind(v); setSemester(0); if (v !== "UNIVERSITY") { setMentionId(""); setCursusLevel(""); } }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition ${kind === v ? "border-online bg-online text-white" : "bg-card hover:bg-accent"}`}
            >
              <Icon className="h-4 w-4" /> {l}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[250px_1fr]">
          {/* Filtres */}
          <aside className={`${showFilters ? "block" : "hidden"} space-y-6 text-sm lg:block`}>
            {kind === "UNIVERSITY" && (
              <>
                <FilterGroup title="Mention">
                  <Radio checked={!mentionId} onChange={() => setMentionId("")}>Toutes</Radio>
                  {mentions.map((m) => <Radio key={m.id} checked={mentionId === m.id} onChange={() => setMentionId(m.id)}>{m.name}</Radio>)}
                </FilterGroup>
                <FilterGroup title="Niveau d'études">
                  <Radio checked={!cursusLevel} onChange={() => { setCursusLevel(""); setSemester(0); }}>Tous</Radio>
                  {LEVELS.map((l) => <Radio key={l} checked={cursusLevel === l} onChange={() => { setCursusLevel(l); setSemester(0); }}>{LEVEL_NAMES[l]} ({l})</Radio>)}
                </FilterGroup>
                {cursusLevel && (
                  <FilterGroup title="Semestre">
                    <Radio checked={!semester} onChange={() => setSemester(0)}>Les deux</Radio>
                    {([1, 2] as const).map((s) => <Radio key={s} checked={semester === s} onChange={() => setSemester(s)}>{semesterLabel(cursusLevel, s)}</Radio>)}
                  </FilterGroup>
                )}
              </>
            )}
            {flatCats.length > 0 && (
              <FilterGroup title="Domaine">
                <Radio checked={!categoryId} onChange={() => setCategoryId("")}>Tous les domaines</Radio>
                {flatCats.map((c) => <Radio key={c.id} checked={categoryId === c.id} onChange={() => setCategoryId(c.id)}>{c.name}</Radio>)}
              </FilterGroup>
            )}
            <FilterGroup title="Niveau de difficulté">
              <Radio checked={!level} onChange={() => setLevel("")}>Tous</Radio>
              <Radio checked={level === "BEGINNER"} onChange={() => setLevel("BEGINNER")}>Débutant</Radio>
              <Radio checked={level === "INTERMEDIATE"} onChange={() => setLevel("INTERMEDIATE")}>Intermédiaire</Radio>
              <Radio checked={level === "ADVANCED"} onChange={() => setLevel("ADVANCED")}>Avancé</Radio>
            </FilterGroup>
            <FilterGroup title="Prix">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} className="rounded" /> Gratuit uniquement
              </label>
            </FilterGroup>
            <FilterGroup title="Note">
              <Radio checked={!minRating} onChange={() => setMinRating(0)}>Toutes</Radio>
              <Radio checked={minRating === 4} onChange={() => setMinRating(4)}>★ 4 et plus</Radio>
              <Radio checked={minRating === 3} onChange={() => setMinRating(3)}>★ 3 et plus</Radio>
            </FilterGroup>
            {(activeFilters || kind !== "ALL") && (
              <button onClick={resetFilters} className="inline-flex items-center gap-1 text-sm font-medium text-online hover:underline">
                <X className="h-3.5 w-3.5" /> Effacer les filtres
              </button>
            )}
          </aside>

          {/* Résultats */}
          <div className="space-y-6">
            {kind === "UNIVERSITY" && !access.isStudent && <BecomeStudentBanner />}
            {catalog.isLoading ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <MoocCardSkeleton key={i} />)}</div>
            ) : catalog.isError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-10 text-center text-sm text-destructive">
                Impossible de charger les cours. Vérifiez que l'API backend est démarrée.
              </div>
            ) : results.length === 0 ? (
              <div className="rounded-xl border border-dashed p-14 text-center text-muted-foreground">
                <BookOpen className="mx-auto h-10 w-10 opacity-20" />
                <p className="mt-3 font-medium">Aucun cours ne correspond à ces critères.</p>
                <button onClick={resetFilters} className="mt-2 text-sm text-online hover:underline">Effacer les filtres</button>
              </div>
            ) : (
              <>
                {kind === "UNIVERSITY" ? (
                  // Cursus universitaire : affichage mois par mois.
                  <CursusMonthsCatalog courses={results} statusOf={access.statusOf} />
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {results.map((c) => (
                      <MoocCard
                        key={c.id}
                        c={c}
                        status={access.statusOf(c)}
                        inWishlist={wishSet.has(c.id)}
                        onToggleWishlist={authed ? () => toggleWishlist.mutate(c.id) : undefined}
                      />
                    ))}
                  </div>
                )}
                {(catalog.data?.total ?? 0) > (catalog.data?.items.length ?? 0) && limit < 48 && (
                  <div className="mt-8 text-center">
                    <button onClick={() => setLimit(48)} className="rounded-lg border px-6 py-2.5 text-sm font-semibold hover:bg-accent">
                      Afficher plus de cours
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── COMMENT ÇA MARCHE ────────────────────────────────────────── */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold tracking-tight">Comment ça marche</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              { Icon: UserPlus, t: "Inscrivez-vous", s: "Créez un compte gratuit et explorez la présentation de chaque cours avant de vous inscrire." },
              { Icon: MonitorPlay, t: "Apprenez à votre rythme", s: "Vidéos, documents, quiz, devoirs et sessions en direct avec les enseignants de l'université." },
              { Icon: Medal, t: "Obtenez votre certificat", s: "Réussissez le test final pour recevoir un certificat ou une attestation vérifiable en ligne." },
            ].map(({ Icon, t, s }, i) => (
              <div key={t} className="rounded-xl border bg-card p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-online/10 text-online"><Icon className="h-5 w-5" /></span>
                  <span className="text-xs font-bold text-muted-foreground">ÉTAPE {i + 1}</span>
                </div>
                <h3 className="mt-3 font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ENSEIGNANTS ──────────────────────────────────────────────── */}
      {instructors.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight">Apprenez avec nos enseignants</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {instructors.map((t) => (
              <Link key={t.id} to="/online/instructor/$id" params={{ id: t.id }}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 transition hover:shadow-md">
                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-online/10 font-bold text-online">
                  {t.avatarUrl ? <img src={mediaUrl(t.avatarUrl)} alt="" className="h-full w-full object-cover" /> : initials(t.firstName, t.lastName)}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{t.firstName} {t.lastName}</div>
                  <div className="text-xs text-muted-foreground">{t.courses} cours · {t.students} apprenant{t.students !== 1 ? "s" : ""}</div>
                  {t.ratingCount > 0 && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{t.ratingAvg.toFixed(1)}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── AVIS ─────────────────────────────────────────────────────── */}
      {highlights.length > 0 && (
        <section className="border-t bg-muted/20">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight">Ce que disent nos apprenants</h2>
            <p className="mt-1 text-sm text-muted-foreground">Avis d'apprenants réellement inscrits aux cours.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {highlights.slice(0, 6).map((h) => (
                <figure key={h.id} className="relative flex flex-col rounded-xl border bg-card p-5">
                  <Quote className="absolute right-4 top-4 h-5 w-5 text-online/20" />
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-3.5 w-3.5 ${i <= h.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />)}
                  </div>
                  <blockquote className="mt-3 flex-1 text-sm leading-relaxed">« {h.comment} »</blockquote>
                  <figcaption className="mt-4 border-t pt-3 text-xs">
                    <div className="font-semibold">{h.studentName}</div>
                    <Link to="/online/course/$id" params={{ id: h.courseId }} className="text-muted-foreground hover:text-online hover:underline">{h.courseTitle}</Link>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── APPEL À L'ACTION ─────────────────────────────────────────── */}
      {!authed && (
        <section className="bg-online text-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-10 sm:px-6 lg:px-8">
            <div>
              <h2 className="text-2xl font-bold">Prêt à commencer ?</h2>
              <p className="mt-1 text-white/80">Créez votre compte gratuit et suivez votre premier cours dès aujourd'hui.</p>
            </div>
            <Link to="/online/register" className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-online hover:bg-white/90">
              S'inscrire gratuitement
            </Link>
          </div>
        </section>
      )}

      {/* ── PIED DE PAGE ─────────────────────────────────────────────── */}
      <footer className="border-t bg-slate-950 text-slate-300">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5">
                <UrMark size={32} />
                <div>
                  <div className="font-bold text-white">{platformName}</div>
                  <div className="text-[11px] text-slate-400">Université Références</div>
                </div>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
                La plateforme d'enseignement en ligne de l'Université Références : cursus universitaire et cours certifiants.
              </p>
            </div>
            <div>
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Apprendre</div>
              <ul className="space-y-2 text-sm">
                <li><button onClick={scrollToCatalogue} className="hover:text-white">Catalogue des cours</button></li>
                <li><button onClick={() => { resetFilters(); setKind("UNIVERSITY"); scrollToCatalogue(); }} className="hover:text-white">Cursus universitaire</button></li>
                <li><Link to="/online/register" className="hover:text-white">Créer un compte gratuit</Link></li>
                <li><Link to="/online/login" className="hover:text-white">Se connecter</Link></li>
              </ul>
            </div>
            <div>
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Enseigner</div>
              <ul className="space-y-2 text-sm">
                <li><Link to="/online/teacher" className="hover:text-white">Espace enseignant</Link></li>
                <li><span className="text-slate-400">Studio de création de cours</span></li>
                <li><span className="text-slate-400">Sessions en direct</span></li>
              </ul>
            </div>
            <div>
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Nos garanties</div>
              <ul className="space-y-2.5 text-sm">
                <li className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 shrink-0 text-emerald-400" /> Certificats vérifiables en ligne</li>
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" /> Contenus protégés</li>
                <li className="flex items-center gap-2"><Smartphone className="h-4 w-4 shrink-0 text-emerald-400" /> Paiement Mobile Money</li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-white/10 pt-6 text-xs text-slate-500">
            {settings?.footerText ?? `© ${new Date().getFullYear()} Université Références. Tous droits réservés.`}
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Filtres ──────────────────────────────────────────────────────────────────

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 font-semibold">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Radio({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-muted-foreground hover:text-foreground">
      <input type="radio" checked={checked} onChange={onChange} className="accent-online" />
      <span className={checked ? "font-medium text-foreground" : ""}>{children}</span>
    </label>
  );
}
