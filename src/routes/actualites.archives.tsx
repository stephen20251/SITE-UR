import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search } from "lucide-react";
import { api } from "@/lib/api";
import { NEWS_CATEGORIES, type NewsArchives } from "@/lib/news";
import { Eyebrow, SITE_FONTS, SitePage, UI, serif } from "@/components/site-layout";
import { NewsRow } from "@/components/news-cards";

export const Route = createFileRoute("/actualites/archives")({
  head: () => ({
    meta: [
      { title: "Archives des actualités — Université Références" },
      { name: "description", content: "Toutes les anciennes publications de l'Université Références." },
    ],
    links: [{ rel: "stylesheet", href: SITE_FONTS }],
  }),
  component: ArchivesPage,
});

const selectCls = "h-11 border border-slate-300 bg-white px-3 text-sm text-[#14204a] outline-none focus:border-[#14204a] dark:border-white/15 dark:bg-[#162036] dark:text-slate-100 dark:focus:border-white/40";

function ArchivesPage() {
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page) });
  if (year) params.set("year", year);
  if (category) params.set("category", category);
  if (q.trim()) params.set("q", q.trim());
  const archives = useQuery({
    queryKey: ["news", "archives", year, category, q.trim(), page],
    queryFn: () => api<NewsArchives>(`/news/public/archives?${params}`, { auth: false }),
    placeholderData: keepPreviousData,
  });
  const d = archives.data;
  const pages = d ? Math.ceil(d.total / d.limit) : 0;

  return (
    <SitePage current="/actualites">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <Link to="/actualites" className={`inline-flex items-center gap-2 hover:underline ${UI.label} ${UI.accent}`}>
          <ArrowLeft className="h-4 w-4" /> Actualités
        </Link>
        <div className="mt-6"><Eyebrow>Archives</Eyebrow></div>
        <h1 className={`mt-4 text-4xl font-semibold sm:text-5xl ${UI.title}`} style={serif}>Anciennes publications</h1>

        <div className="mt-8 flex flex-wrap gap-3">
          <div className="relative min-w-52 flex-1">
            <Search className={`absolute left-3 top-3.5 h-4 w-4 ${UI.muted}`} />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Rechercher…" aria-label="Rechercher dans les archives" className={`${selectCls} w-full pl-9`} />
          </div>
          <select value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }} aria-label="Année" className={selectCls}>
            <option value="">Toutes les années</option>
            {(d?.years ?? []).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Rubrique" className={selectCls}>
            <option value="">Toutes les rubriques</option>
            {NEWS_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div className="mt-8 space-y-4">
          {archives.isError && <p className={`py-10 text-center ${UI.text}`}>Les archives n'ont pas pu être chargées.</p>}
          {d && d.items.length === 0 && (
            <div className={`p-10 text-center ${UI.card}`}>
              <p className={UI.text}>Aucune publication ne correspond à cette recherche.</p>
            </div>
          )}
          {d?.items.map((a) => <NewsRow key={a.id} item={a} showCategory />)}
        </div>

        {pages > 1 && (
          <div className={`mt-10 flex items-center justify-center gap-4 text-sm ${UI.text}`}>
            <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className="border border-[#14204a] px-4 py-2 font-medium text-[#14204a] transition hover:bg-[#14204a] hover:text-white disabled:pointer-events-none disabled:opacity-30 dark:border-white/30 dark:text-white dark:hover:bg-white dark:hover:text-[#0b1120]">Précédent</button>
            <span>Page {page} sur {pages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= pages} className="border border-[#14204a] px-4 py-2 font-medium text-[#14204a] transition hover:bg-[#14204a] hover:text-white disabled:pointer-events-none disabled:opacity-30 dark:border-white/30 dark:text-white dark:hover:bg-white dark:hover:text-[#0b1120]">Suivant</button>
          </div>
        )}
      </div>
    </SitePage>
  );
}
