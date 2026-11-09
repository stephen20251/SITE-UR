// Cartes de la page « Actualités ».
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, ExternalLink, MapPin, Users } from "lucide-react";
import { categoryLabel, fmtNewsDate, fmtNewsDateTime, newsImage, type NewsSummary } from "@/lib/news";
import { CARD, RED, RED_SOFT, serif } from "@/components/site-layout";

const FALLBACK_BG = "linear-gradient(135deg, #1b1a4a 0%, #26246b 55%, #6b1418 100%)";

export function CategoryBadge({ item }: { item: Pick<NewsSummary, "category"> }) {
  return (
    <span className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white" style={{ background: RED }}>
      {categoryLabel(item.category)}
    </span>
  );
}

function EventDetails({ item }: { item: NewsSummary }) {
  if (!item.eventAt && !item.location) return null;
  return (
    <div className="mt-3 space-y-1 text-sm text-slate-400">
      {item.eventAt && <p className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" /> {fmtNewsDateTime(item.eventAt)}</p>}
      {item.location && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {item.location}</p>}
    </div>
  );
}

// Grande actualité « à la une », avec image.
export function FeaturedNews({ item }: { item: NewsSummary }) {
  const img = newsImage(item.imageUrl);
  return (
    <Link to="/actualites/$slug" params={{ slug: item.slug }} className="group relative block overflow-hidden rounded-3xl ring-1 ring-white/10">
      <div className="relative aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9]">
        {img
          ? <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
          : <div className="absolute inset-0" style={{ background: FALLBACK_BG }} />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
          <CategoryBadge item={item} />
          <h2 className="mt-4 max-w-4xl text-3xl font-bold leading-tight text-white sm:text-5xl" style={serif}>{item.title}</h2>
          {item.excerpt && <p className="mt-4 hidden max-w-3xl text-lg leading-relaxed text-slate-200 sm:block">{item.excerpt}</p>}
          <p className="mt-4 text-sm font-medium text-slate-300">{fmtNewsDate(item.publishedAt)}</p>
        </div>
      </div>
    </Link>
  );
}

export function NewsCard({ item }: { item: NewsSummary }) {
  const img = newsImage(item.imageUrl);
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl ring-1 ring-white/10 transition hover:ring-white/25" style={{ background: CARD }}>
      <Link to="/actualites/$slug" params={{ slug: item.slug }} className="relative block aspect-[16/10] overflow-hidden">
        {img
          ? <img src={img} alt="" className="h-full w-full object-cover" />
          : <div className="h-full w-full" style={{ background: FALLBACK_BG }} />}
        <span className="absolute left-4 top-4"><CategoryBadge item={item} /></span>
      </Link>
      <div className="flex flex-1 flex-col p-6">
        <p className="text-xs font-medium text-slate-400">{fmtNewsDate(item.publishedAt)}</p>
        <h3 className="mt-2 text-xl font-bold leading-snug text-white" style={serif}>
          <Link to="/actualites/$slug" params={{ slug: item.slug }} className="hover:underline">{item.title}</Link>
        </h3>
        <EventDetails item={item} />
        {item.excerpt && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-300">{item.excerpt}</p>}
      </div>
    </article>
  );
}

// Ligne compacte : annonces, résultats, publications, archives.
export function NewsRow({ item, showCategory = false }: { item: NewsSummary; showCategory?: boolean }) {
  return (
    <article className="rounded-2xl p-5 ring-1 ring-white/10 transition hover:ring-white/25" style={{ background: CARD }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-400">
        <span>{fmtNewsDate(item.publishedAt)}</span>
        {showCategory && <span style={{ color: RED_SOFT }}>{categoryLabel(item.category)}</span>}
      </div>
      <h3 className="mt-2 text-lg font-bold leading-snug text-white" style={serif}>
        <Link to="/actualites/$slug" params={{ slug: item.slug }} className="hover:underline">{item.title}</Link>
      </h3>
      {item.authors && <p className="mt-2 flex items-start gap-2 text-sm text-slate-400"><Users className="mt-0.5 h-4 w-4 shrink-0" /> {item.authors}</p>}
      <EventDetails item={item} />
      {item.excerpt && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-300">{item.excerpt}</p>}
      <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium" style={{ color: RED_SOFT }}>
        <Link to="/actualites/$slug" params={{ slug: item.slug }} className="inline-flex items-center gap-1 hover:underline">Lire <ArrowRight className="h-4 w-4" /></Link>
        {item.linkUrl && (
          <a href={item.linkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline"><ExternalLink className="h-4 w-4" /> Document</a>
        )}
      </div>
    </article>
  );
}
