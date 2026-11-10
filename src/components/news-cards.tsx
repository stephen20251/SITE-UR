// Cartes de la page « Actualités » (thèmes clair et sombre, voir site-layout).
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, ExternalLink, MapPin, Users } from "lucide-react";
import { categoryLabel, fmtNewsDate, fmtNewsDateTime, newsImage, type NewsSummary } from "@/lib/news";
import { UI, serif } from "@/components/site-layout";

// Fond d'une actualité sans image
const FALLBACK = "bg-neutral-200 dark:bg-gradient-to-br dark:from-[#1b1a4a] dark:via-[#26246b] dark:to-[#6b1418]";

export function CategoryBadge({ item }: { item: Pick<NewsSummary, "category"> }) {
  return (
    <span className={`inline-block bg-black px-3 py-1.5 text-white dark:bg-[#e3262b] ${UI.label} !text-[10px] !tracking-[0.2em]`}>
      {categoryLabel(item.category)}
    </span>
  );
}

function EventDetails({ item }: { item: NewsSummary }) {
  if (!item.eventAt && !item.location) return null;
  return (
    <div className={`mt-3 space-y-1 text-sm ${UI.muted}`}>
      {item.eventAt && <p className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" /> {fmtNewsDateTime(item.eventAt)}</p>}
      {item.location && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {item.location}</p>}
    </div>
  );
}

// Grande actualité « à la une », avec image.
export function FeaturedNews({ item }: { item: NewsSummary }) {
  const img = newsImage(item.imageUrl);
  return (
    <Link to="/actualites/$slug" params={{ slug: item.slug }} className="group relative block overflow-hidden bg-black">
      <div className="relative aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9]">
        {img
          ? <img src={img} alt="" className={`absolute inset-0 h-full w-full object-cover ${UI.photo} transition-transform duration-700 group-hover:scale-[1.03]`} />
          : <div className={`absolute inset-0 ${FALLBACK}`} />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
          <CategoryBadge item={item} />
          <h2 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight text-white sm:text-5xl" style={serif}>{item.title}</h2>
          {item.excerpt && <p className="mt-4 hidden max-w-3xl text-lg leading-relaxed text-neutral-200 sm:block">{item.excerpt}</p>}
          <p className={`mt-4 text-neutral-300 ${UI.label}`}>{fmtNewsDate(item.publishedAt)}</p>
        </div>
      </div>
    </Link>
  );
}

export function NewsCard({ item }: { item: NewsSummary }) {
  const img = newsImage(item.imageUrl);
  return (
    <article className="group flex flex-col">
      <Link to="/actualites/$slug" params={{ slug: item.slug }} className="relative block aspect-[16/10] overflow-hidden bg-neutral-100 dark:bg-[#162036]">
        {img
          ? <img src={img} alt="" className={`h-full w-full object-cover ${UI.photo} transition duration-700 group-hover:scale-[1.03]`} />
          : <div className={`h-full w-full ${FALLBACK}`} />}
        <span className="absolute left-0 top-0"><CategoryBadge item={item} /></span>
      </Link>
      <div className="flex flex-1 flex-col pt-5">
        <p className={`${UI.label} ${UI.muted} !text-[10px]`}>{fmtNewsDate(item.publishedAt)}</p>
        <h3 className={`mt-2 text-xl font-semibold leading-snug ${UI.title}`} style={serif}>
          <Link to="/actualites/$slug" params={{ slug: item.slug }} className="hover:underline">{item.title}</Link>
        </h3>
        <EventDetails item={item} />
        {item.excerpt && <p className={`mt-3 line-clamp-3 text-sm leading-relaxed ${UI.text}`}>{item.excerpt}</p>}
      </div>
    </article>
  );
}

// Ligne compacte : annonces, résultats, publications, archives.
export function NewsRow({ item, showCategory = false }: { item: NewsSummary; showCategory?: boolean }) {
  return (
    <article className={`p-6 transition hover:ring-neutral-400 dark:hover:ring-white/25 ${UI.card}`}>
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${UI.label} !text-[10px]`}>
        <span className={UI.muted}>{fmtNewsDate(item.publishedAt)}</span>
        {showCategory && <span className={UI.accent}>{categoryLabel(item.category)}</span>}
      </div>
      <h3 className={`mt-3 text-lg font-semibold leading-snug ${UI.title}`} style={serif}>
        <Link to="/actualites/$slug" params={{ slug: item.slug }} className="hover:underline">{item.title}</Link>
      </h3>
      {item.authors && <p className={`mt-2 flex items-start gap-2 text-sm ${UI.muted}`}><Users className="mt-0.5 h-4 w-4 shrink-0" /> {item.authors}</p>}
      <EventDetails item={item} />
      {item.excerpt && <p className={`mt-2 line-clamp-2 text-sm leading-relaxed ${UI.text}`}>{item.excerpt}</p>}
      <div className={`mt-4 flex flex-wrap gap-5 ${UI.label} !text-[10px] ${UI.accent}`}>
        <Link to="/actualites/$slug" params={{ slug: item.slug }} className="inline-flex items-center gap-1.5 hover:underline">Lire <ArrowRight className="h-3.5 w-3.5" /></Link>
        {item.linkUrl && (
          <a href={item.linkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Document</a>
        )}
      </div>
    </article>
  );
}
