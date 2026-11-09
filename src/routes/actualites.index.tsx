import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Archive, ArrowRight, Loader2, Newspaper } from "lucide-react";
import { api } from "@/lib/api";
import type { NewsPage } from "@/lib/news";
import type { UniversityEvent } from "@/lib/events";
import { BG, BG_ALT, CARD, EventCard, Eyebrow, RED_SOFT, SITE_FONTS, SiteFooter, SiteHeader, serif } from "@/components/site-layout";
import { FeaturedNews, NewsCard, NewsRow } from "@/components/news-cards";

export const Route = createFileRoute("/actualites/")({
  head: () => ({
    meta: [
      { title: "Actualités — Université Références" },
      { name: "description", content: "Annonces officielles, événements, conférences, soutenances, publications scientifiques et vie de l'Université Références." },
    ],
    links: [{ rel: "stylesheet", href: SITE_FONTS }],
  }),
  component: NewsHome,
});

function Section({ id, eyebrow, title, alt = false, children }: { id: string; eyebrow: string; title: string; alt?: boolean; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32" style={alt ? { background: BG_ALT } : undefined}>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl" style={serif}>{title}</h2>
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
    <div className="min-h-screen text-slate-300" style={{ background: BG }}>
      <SiteHeader />

      <div className="mx-auto max-w-7xl px-4 pb-6 pt-12 sm:px-6 lg:px-8">
        <Eyebrow>Université Références</Eyebrow>
        <h1 className="mt-2 text-4xl font-bold text-white sm:text-6xl" style={serif}>Actualités</h1>
      </div>

      {page.isLoading && <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin" aria-label="Chargement" /></div>}

      {page.isError && (
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="text-slate-300">Les actualités n'ont pas pu être chargées. Réessayez dans un instant.</p>
          <button onClick={() => page.refetch()} className="mt-3 text-sm font-semibold hover:underline" style={{ color: RED_SOFT }}>Réessayer</button>
        </div>
      )}

      {empty && (
        <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="rounded-2xl p-10 text-center ring-1 ring-white/10" style={{ background: CARD }}>
            <Newspaper className="mx-auto h-10 w-10 text-slate-500" />
            <p className="mt-3 text-slate-300">Aucune actualité pour le moment.</p>
            <p className="text-sm text-slate-500">Les prochaines publications de l'université paraîtront ici.</p>
          </div>
        </div>
      )}

      {d?.featured && (
        <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <FeaturedNews item={d.featured} />
        </div>
      )}

      {toc.length > 1 && (
        <nav aria-label="Rubriques" className="sticky top-[76px] z-40 border-y border-white/10 backdrop-blur" style={{ background: "rgba(11,17,32,0.92)" }}>
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] sm:px-6 lg:px-8">
            {toc.map((t) => (
              <a key={t.href} href={t.href} className="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium text-slate-200 ring-1 ring-white/15 hover:bg-white/10">{t.label}</a>
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
          <div className="grid gap-4 md:grid-cols-2">{d.officialAnnouncements.map((a) => <NewsRow key={a.id} item={a} />)}</div>
        </Section>
      )}
      {eventList.length > 0 && (
        <Section id="evenements" eyebrow="Agenda" title="Événements de l'établissement">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">{eventList.map((ev) => <EventCard key={ev.id} ev={ev} />)}</div>
        </Section>
      )}
      {d && d.conferences.length > 0 && (
        <Section id="conferences" eyebrow="Vie scientifique" title="Conférences et soutenances" alt>
          <div className="grid gap-4 md:grid-cols-2">{d.conferences.map((a) => <NewsRow key={a.id} item={a} showCategory />)}</div>
        </Section>
      )}
      {d && d.publications.length > 0 && (
        <Section id="publications" eyebrow="Recherche" title="Publications scientifiques">
          <div className="grid gap-4 md:grid-cols-2">{d.publications.map((a) => <NewsRow key={a.id} item={a} />)}</div>
        </Section>
      )}
      {d && d.results.length > 0 && (
        <Section id="resultats" eyebrow="Scolarité" title="Résultats et annonces académiques" alt>
          <div className="grid gap-4 md:grid-cols-2">{d.results.map((a) => <NewsRow key={a.id} item={a} />)}</div>
        </Section>
      )}
      {d && d.activities.length > 0 && (
        <Section id="activites" eyebrow="Vie de l'université" title="Activités des enseignants et des étudiants">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">{d.activities.map((a) => <NewsCard key={a.id} item={a} />)}</div>
        </Section>
      )}
      {d && d.archiveCount > 0 && (
        <section id="archives" className="scroll-mt-32" style={{ background: BG_ALT }}>
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-4 py-14 sm:px-6 lg:px-8">
            <div>
              <Eyebrow>Archives</Eyebrow>
              <h2 className="mt-2 text-3xl font-bold text-white" style={serif}>Anciennes publications</h2>
              <p className="mt-2 text-slate-400">{d.archiveCount} publication{d.archiveCount > 1 ? "s" : ""}, à retrouver par année et par rubrique.</p>
            </div>
            <Link to="/actualites/archives" className="inline-flex items-center gap-2 rounded-md border border-white/20 px-6 py-3 font-semibold text-white hover:bg-white/5">
              <Archive className="h-4 w-4" /> Consulter les archives <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}
