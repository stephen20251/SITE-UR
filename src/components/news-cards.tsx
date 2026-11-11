// Cartes de la page « Actualités » (thèmes clair et sombre, voir site-layout).
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, ExternalLink, MapPin, Users } from "lucide-react";
import { categoryLabel, fmtNewsDate, fmtNewsDateTime, newsImage, type NewsSummary } from "@/lib/news";
import { UI, serif } from "@/components/site-layout";

// Fond d'une actualité sans image
const FALLBACK = "bg-slate-200 dark:bg-gradient-to-br dark:from-[#1b1a4a] dark:via-[#26246b] dark:to-[#6b1418]";

export function CategoryBadge({ item }: { item: Pick<NewsSummary, "category"> }) {
  return (
    <span className={`inline-block bg-[#e3262b] px-3 py-1.5 text-white ${UI.label} !text-[10px] !tracking-[0.2em]`}>
      {categoryLabel(item.category)}
    </span>
  );
}

// Petits badges des cartes : date en rouge, rubrique en bleu marine.
export function DateBadge({ date, className = "" }: { date: string | null | undefined; className?: string }) {
  if (!date) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-[#e3262b] px-3 py-1 text-[11px] font-semibold text-white shadow-sm ${className}`}>
      <CalendarDays className="h-3 w-3" /> {fmtNewsDate(date)}
    </span>
  );
}

export function NavyBadge({ item, className = "" }: { item: Pick<NewsSummary, "category">; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full bg-[#14204a] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white ring-1 ring-white/10 dark:bg-[#1e2d5e] ${className}`}>
      {categoryLabel(item.category)}
    </span>
  );
}

const CARD = "rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_-4px_rgba(20,32,74,0.12)] transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_24px_48px_-24px_rgba(20,32,74,0.35)] dark:border-white/10 dark:bg-[#162036] dark:shadow-none dark:hover:border-white/20 dark:hover:shadow-[0_24px_48px_-24px_rgba(0,0,0,0.7)]";

function ReadMore({ slug, className = "" }: { slug: string; className?: string }) {
  return (
    <Link to="/actualites/$slug" params={{ slug }} className={`group/rm inline-flex items-center gap-1.5 text-sm font-semibold ${UI.accent} ${className}`}>
      Lire la suite <ArrowRight className="h-4 w-4 transition group-hover/rm:translate-x-1" />
    </Link>
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
    <Link to="/actualites/$slug" params={{ slug: item.slug }} className="group relative block overflow-hidden rounded-3xl bg-[#14204a] shadow-[0_30px_60px_-30px_rgba(20,32,74,0.6)] ring-1 ring-black/5 dark:ring-white/10">
      <div className="relative aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9]">
        {img
          ? <img src={img} alt="" className={`absolute inset-0 h-full w-full object-cover ${UI.photo} transition-transform duration-700 group-hover:scale-[1.03]`} />
          : <div className={`absolute inset-0 ${FALLBACK}`} />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1430]/90 via-[#0b1430]/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
          <div className="flex flex-wrap items-center gap-2"><NavyBadge item={item} /><DateBadge date={item.publishedAt} /></div>
          <h2 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight text-white sm:text-5xl" style={serif}>{item.title}</h2>
          {item.excerpt && <p className="mt-4 hidden max-w-3xl text-lg leading-relaxed text-slate-200 sm:block">{item.excerpt}</p>}
          <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur transition group-hover:bg-white group-hover:text-[#14204a]">
            Lire la suite <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  );
}

// Grande carte d'actualité : image, badges, titre, résumé et « Lire la suite ».
export function NewsCard({ item }: { item: NewsSummary }) {
  const img = newsImage(item.imageUrl);
  return (
    <article className={`group flex flex-col overflow-hidden ${CARD}`}>
      <Link to="/actualites/$slug" params={{ slug: item.slug }} className="relative block aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-[#0f172a]">
        {img
          ? <img src={img} alt="" loading="lazy" className={`h-full w-full object-cover ${UI.photo} transition duration-700 group-hover:scale-[1.04]`} />
          : <div className={`h-full w-full ${FALLBACK}`} />}
        <span className="absolute left-4 top-4"><NavyBadge item={item} /></span>
      </Link>
      <div className="flex flex-1 flex-col p-6">
        <DateBadge date={item.publishedAt} className="self-start" />
        <h3 className={`mt-4 text-xl font-semibold leading-snug ${UI.title}`} style={serif}>
          <Link to="/actualites/$slug" params={{ slug: item.slug }} className="hover:underline">{item.title}</Link>
        </h3>
        <EventDetails item={item} />
        {item.excerpt && <p className={`mt-3 line-clamp-3 text-sm leading-relaxed ${UI.text}`}>{item.excerpt}</p>}
        <div className={`mt-auto flex flex-wrap items-center gap-5 border-t pt-5 ${UI.border} ${item.excerpt || item.eventAt || item.location ? "mt-6" : "mt-5"}`}>
          <ReadMore slug={item.slug} />
          {item.linkUrl && (
            <a href={item.linkUrl} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 text-sm ${UI.muted} hover:underline`}><ExternalLink className="h-3.5 w-3.5" /> Document</a>
          )}
        </div>
      </div>
    </article>
  );
}

// Carte simple (section « Dans la même rubrique », inchangée).
export function NewsCardSimple({ item }: { item: NewsSummary }) {
  const img = newsImage(item.imageUrl);
  return (
    <article className="group flex flex-col">
      <Link to="/actualites/$slug" params={{ slug: item.slug }} className="relative block aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-[#162036]">
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
    <article className={`flex flex-col p-6 ${CARD}`}>
      <div className="flex flex-wrap items-center gap-2">
        <DateBadge date={item.publishedAt} />
        {showCategory && <NavyBadge item={item} />}
      </div>
      <h3 className={`mt-3 text-lg font-semibold leading-snug ${UI.title}`} style={serif}>
        <Link to="/actualites/$slug" params={{ slug: item.slug }} className="hover:underline">{item.title}</Link>
      </h3>
      {item.authors && <p className={`mt-2 flex items-start gap-2 text-sm ${UI.muted}`}><Users className="mt-0.5 h-4 w-4 shrink-0" /> {item.authors}</p>}
      <EventDetails item={item} />
      {item.excerpt && <p className={`mt-2 line-clamp-2 text-sm leading-relaxed ${UI.text}`}>{item.excerpt}</p>}
      <div className={`mt-auto flex flex-wrap items-center gap-5 pt-5`}>
        <ReadMore slug={item.slug} />
        {item.linkUrl && (
          <a href={item.linkUrl} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 text-sm ${UI.muted} hover:underline`}><ExternalLink className="h-3.5 w-3.5" /> Document</a>
        )}
      </div>
    </article>
  );
}
