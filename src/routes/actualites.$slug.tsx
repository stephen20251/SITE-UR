import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, ExternalLink, Loader2, MapPin, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { fmtNewsDate, fmtNewsDateTime, newsImage, type NewsArticle, type NewsSummary } from "@/lib/news";
import { BG, BG_ALT, RED, RED_SOFT, SITE_FONTS, SiteFooter, SiteHeader, serif } from "@/components/site-layout";
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
    <div className="min-h-screen text-slate-300" style={{ background: BG }}>
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link to="/actualites" className="inline-flex items-center gap-2 text-sm font-medium hover:underline" style={{ color: RED_SOFT }}>
          <ArrowLeft className="h-4 w-4" /> Actualités
        </Link>
        {query.isLoading && <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}
        {query.isError && (
          <p className="py-20 text-center">
            {query.error instanceof ApiError && query.error.status === 404
              ? "Cette actualité n'existe pas ou n'est plus publiée."
              : "Cette actualité n'a pas pu être chargée."}
          </p>
        )}
        {a && (
          <>
            <div className="mt-6"><CategoryBadge item={a} /></div>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-white sm:text-5xl" style={serif}>{a.title}</h1>
            <p className="mt-4 text-sm font-medium text-slate-400">Publié le {fmtNewsDate(a.publishedAt)}</p>
            {(a.authors || a.eventAt || a.location) && (
              <div className="mt-4 space-y-1.5 text-sm text-slate-300">
                {a.authors && <p className="flex items-start gap-2"><Users className="mt-0.5 h-4 w-4 shrink-0" /> {a.authors}</p>}
                {a.eventAt && <p className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" /> {fmtNewsDateTime(a.eventAt)}</p>}
                {a.location && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {a.location}</p>}
              </div>
            )}
            {img && <img src={img} alt="" className="mt-8 aspect-[16/9] w-full rounded-2xl object-cover ring-1 ring-white/10" />}
            {a.excerpt && <p className="mt-8 text-xl leading-relaxed text-slate-100">{a.excerpt}</p>}
            <div className="mt-6 whitespace-pre-line text-base leading-relaxed text-slate-300">{a.body}</div>
            {a.linkUrl && (
              <a href={a.linkUrl} target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-semibold text-white" style={{ background: RED }}>
                <ExternalLink className="h-4 w-4" /> Consulter le document
              </a>
            )}
          </>
        )}
      </article>
      {related.length > 0 && (
        <section style={{ background: BG_ALT }}>
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-white" style={serif}>Dans la même rubrique</h2>
            <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">{related.map((r) => <NewsCard key={r.id} item={r} />)}</div>
          </div>
        </section>
      )}
      <SiteFooter />
    </div>
  );
}
