import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Archive, ArrowRight, Loader2, Newspaper } from "lucide-react";
import { api } from "@/lib/api";
import type { NewsPage } from "@/lib/news";
import type { UniversityEvent } from "@/lib/events";
import { EventCard, Eyebrow, SITE_FONTS, SitePage, UI, serif } from "@/components/site-layout";
import { FeaturedNews, NewsCard, NewsRow } from "@/components/news-cards";

export const Route = createFileRoute("/actualites/")({
  head: () => ({
    meta: [
      { title: "Actualités — Université Références" },
      { name: "description", content: "Annonces officielles, événements, conférences, soutenances, publications scientifiques et vie de l'Université Références." },
    ],
    links: [{ rel: "stylesheet", href: SITE_FONTS }, { rel: "canonical", href: "https://univreference.com/actualites" }],
  }),
  component: NewsHome,
});

function Section({ id, eyebrow, title, alt = false, children }: { id: string; eyebrow: string; title: string; alt?: boolean; children: React.ReactNode }) {
  return (
    <section id={id} className={`scroll-mt-36 ${alt ? UI.altBg : ""}`}>
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className={`mt-4 text-3xl font-semibold leading-[1.1] sm:text-4xl ${UI.title}`} style={serif}>{title}</h2>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

function NewsHome() {
  const page = useQuery({
    queryKey: ["news", "public"],
    queryFn: () => api<NewsPage>("/news/public", { auth: false }),
    staleTime: 60_000,
  });
  const events = useQuery({
    queryKey: ["events", "public", "news"],
    queryFn: () => api<UniversityEvent[]>("/events/public?limit=6", { auth: false }),
    staleTime: 60_000,
  });
  const d = page.data;
  const eventList = events.data ?? [];

  // Les rubriques vides n'apparaissent ni dans le sommaire ni sur la page.
  const toc = [
    { href: "#dernieres", label: "Dernières actualités", show: (d?.latest.length ?? 0) > 0 },
    { href: "#annonces", label: "Annonces officielles", show: (d?.officialAnnouncements.length ?? 0) > 0 },
    { href: "#evenements", label: "Événements", show: eventList.length > 0 },
    { href: "#conferences", label: "Conférences et soutenances", show: (d?.conferences.length ?? 0) > 0 },
    { href: "#publications", label: "Publications scientifiques", show: (d?.publications.length ?? 0) > 0 },
    { href: "#resultats", label: "Résultats", show: (d?.results.length ?? 0) > 0 },
    { href: "#activites", label: "Activités", show: (d?.activities.length ?? 0) > 0 },
    { href: "#archives", label: "Archives", show: (d?.archiveCount ?? 0) > 0 },
  ].filter((t) => t.show);
  const empty = d && !d.featured && eventList.length === 0 && d.archiveCount === 0;

  return (
    <SitePage current="/actualites">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 lg:px-8">
        <Eyebrow>Université Références</Eyebrow>
        <h1 className={`mt-4 text-5xl font-semibold leading-[1.02] sm:text-7xl ${UI.title}`} style={serif}>Actualités</h1>
      </div>

      {page.isLoading && <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin" aria-label="Chargement" /></div>}

      {page.isError && (
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className={UI.text}>Les actualités n'ont pas pu être chargées. Réessayez dans un instant.</p>
          <button onClick={() => page.refetch()} className={`mt-3 hover:underline ${UI.label} ${UI.accent}`}>Réessayer</button>
        </div>
      )}

      {empty && (
        <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className={`p-12 text-center ${UI.card}`}>
            <Newspaper className={`mx-auto h-10 w-10 ${UI.muted}`} strokeWidth={1.25} />
            <p className={`mt-4 text-xl font-semibold ${UI.title}`} style={serif}>Aucune actualité pour le moment.</p>
            <p className={`mt-1 text-sm ${UI.muted}`}>Les prochaines publications de l'université paraîtront ici.</p>
          </div>
        </div>
      )}

      {d?.featured && (
        <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <FeaturedNews item={d.featured} />
        </div>
      )}

      {toc.length > 1 && (
        <nav aria-label="Rubriques" className="sticky top-20 z-40 border-y border-slate-200 bg-white/90 backdrop-blur-md dark:border-white/10 dark:bg-[#0b1120]/90">
          <div className="mx-auto flex max-w-7xl gap-8 overflow-x-auto px-4 [scrollbar-width:none] sm:px-6 lg:px-8">
            {toc.map((t) => (
              <a key={t.href} href={t.href} className={`group relative shrink-0 py-4 text-slate-600 transition hover:text-[#14204a] dark:text-slate-300 dark:hover:text-white ${UI.label} !text-[10px]`}>
                {t.label}
                <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-[#14204a] transition-transform duration-300 group-hover:scale-x-100 dark:bg-[#e3262b]" />
              </a>
            ))}
          </div>
        </nav>
      )}

      {d && d.latest.length > 0 && (
        <Section id="dernieres" eyebrow="À lire" title="Dernières actualités">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">{d.latest.map((a) => <NewsCard key={a.id} item={a} />)}</div>
        </Section>
      )}
      {d && d.officialAnnouncements.length > 0 && (
        <Section id="annonces" eyebrow="Direction" title="Annonces officielles de la direction" alt>
          <div className="grid gap-6 md:grid-cols-2">{d.officialAnnouncements.map((a) => <NewsRow key={a.id} item={a} />)}</div>
        </Section>
      )}
      {eventList.length > 0 && (
        <Section id="evenements" eyebrow="Agenda" title="Événements de l'établissement">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{eventList.map((ev) => <EventCard key={ev.id} ev={ev} />)}</div>
        </Section>
      )}
      {d && d.conferences.length > 0 && (
        <Section id="conferences" eyebrow="Vie scientifique" title="Conférences et soutenances" alt>
          <div className="grid gap-6 md:grid-cols-2">{d.conferences.map((a) => <NewsRow key={a.id} item={a} showCategory />)}</div>
        </Section>
      )}
      {d && d.publications.length > 0 && (
        <Section id="publications" eyebrow="Recherche" title="Publications scientifiques">
          <div className="grid gap-6 md:grid-cols-2">{d.publications.map((a) => <NewsRow key={a.id} item={a} />)}</div>
        </Section>
      )}
      {d && d.results.length > 0 && (
        <Section id="resultats" eyebrow="Scolarité" title="Résultats et annonces académiques" alt>
          <div className="grid gap-6 md:grid-cols-2">{d.results.map((a) => <NewsRow key={a.id} item={a} />)}</div>
        </Section>
      )}
      {d && d.activities.length > 0 && (
        <Section id="activites" eyebrow="Vie de l'université" title="Activités des enseignants et des étudiants">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">{d.activities.map((a) => <NewsCard key={a.id} item={a} />)}</div>
        </Section>
      )}
      {d && d.archiveCount > 0 && (
        <section id="archives" className={`scroll-mt-36 ${UI.altBg}`}>
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-4 py-14 sm:px-6 lg:px-8">
            <div>
              <Eyebrow>Archives</Eyebrow>
              <h2 className={`mt-4 text-3xl font-semibold ${UI.title}`} style={serif}>Anciennes publications</h2>
              <p className={`mt-2 ${UI.text}`}>{d.archiveCount} publication{d.archiveCount > 1 ? "s" : ""}, à retrouver par année et par rubrique.</p>
            </div>
            <Link to="/actualites/archives" className={UI.btnLine}>
              <Archive className="h-4 w-4" /> Consulter les archives <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

    </SitePage>
  );
}
