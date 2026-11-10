import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, ExternalLink, Loader2, MapPin, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { fmtNewsDate, fmtNewsDateTime, newsImage, type NewsArticle, type NewsSummary } from "@/lib/news";
import { SITE_FONTS, SitePage, UI, serif } from "@/components/site-layout";
import { CategoryBadge, NewsCard } from "@/components/news-cards";

export const Route = createFileRoute("/actualites/$slug")({
  head: () => ({
    meta: [{ title: "Actualité — Université Références" }],
    links: [{ rel: "stylesheet", href: SITE_FONTS }],
  }),
  component: ArticlePage,
});

function ArticlePage() {
  const { slug } = Route.useParams();
  const query = useQuery({
    queryKey: ["news", "article", slug],
    queryFn: () => api<{ article: NewsArticle; related: NewsSummary[] }>(`/news/public/${encodeURIComponent(slug)}`, { auth: false }),
    retry: false,
  });
  const a = query.data?.article;
  const related = query.data?.related ?? [];
  const img = a ? newsImage(a.imageUrl) : null;

  return (
    <SitePage current="/actualites">
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <Link to="/actualites" className={`inline-flex items-center gap-2 hover:underline ${UI.label} ${UI.accent}`}>
          <ArrowLeft className="h-4 w-4" /> Actualités
        </Link>
        {query.isLoading && <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}
        {query.isError && (
          <p className={`py-20 text-center ${UI.text}`}>
            {query.error instanceof ApiError && query.error.status === 404
              ? "Cette actualité n'existe pas ou n'est plus publiée."
              : "Cette actualité n'a pas pu être chargée."}
          </p>
        )}
        {a && (
          <>
            <div className="mt-8"><CategoryBadge item={a} /></div>
            <h1 className={`mt-5 text-4xl font-semibold leading-tight sm:text-5xl ${UI.title}`} style={serif}>{a.title}</h1>
            <p className={`mt-5 ${UI.label} ${UI.muted}`}>Publié le {fmtNewsDate(a.publishedAt)}</p>
            {(a.authors || a.eventAt || a.location) && (
              <div className={`mt-4 space-y-1.5 text-sm ${UI.text}`}>
                {a.authors && <p className="flex items-start gap-2"><Users className="mt-0.5 h-4 w-4 shrink-0" /> {a.authors}</p>}
                {a.eventAt && <p className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" /> {fmtNewsDateTime(a.eventAt)}</p>}
                {a.location && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {a.location}</p>}
              </div>
            )}
            {img && <img src={img} alt="" className={`mt-10 aspect-[16/9] w-full object-cover ${UI.photo}`} />}
            {a.excerpt && <p className={`mt-10 text-xl leading-relaxed ${UI.title}`} style={serif}>{a.excerpt}</p>}
            <div className={`mt-6 whitespace-pre-line text-base leading-relaxed ${UI.text}`}>{a.body}</div>
            {a.linkUrl && (
              <a href={a.linkUrl} target="_blank" rel="noreferrer" className={`mt-10 ${UI.btnDark}`}>
                <ExternalLink className="h-4 w-4" /> Consulter le document
              </a>
            )}
          </>
        )}
      </article>
      {related.length > 0 && (
        <section className={UI.altBg}>
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <h2 className={`text-3xl font-semibold ${UI.title}`} style={serif}>Dans la même rubrique</h2>
            <div className="mt-10 grid gap-10 md:grid-cols-2 lg:grid-cols-3">{related.map((r) => <NewsCard key={r.id} item={r} />)}</div>
          </div>
        </section>
      )}
    </SitePage>
  );
}
