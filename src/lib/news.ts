// Page « Actualités » du site : contenus publiés par le Super administrateur.
import { API_BASE } from "./api";

export type NewsCategory = "ACTUALITE" | "ANNONCE_OFFICIELLE" | "CONFERENCE" | "SOUTENANCE" | "PUBLICATION" | "RESULTAT" | "ACTIVITE";

export const NEWS_CATEGORIES: { value: NewsCategory; label: string }[] = [
  { value: "ACTUALITE", label: "Actualité" },
  { value: "ANNONCE_OFFICIELLE", label: "Annonce officielle" },
  { value: "CONFERENCE", label: "Conférence" },
  { value: "SOUTENANCE", label: "Soutenance" },
  { value: "PUBLICATION", label: "Publication scientifique" },
  { value: "RESULTAT", label: "Résultats et annonces académiques" },
  { value: "ACTIVITE", label: "Activités enseignants et étudiants" },
];
export const categoryLabel = (c: NewsCategory) => NEWS_CATEGORIES.find((x) => x.value === c)?.label ?? c;

export type NewsSummary = {
  id: string; slug: string; title: string; excerpt: string | null; imageUrl: string | null;
  category: NewsCategory; authors: string | null; location: string | null; eventAt: string | null;
  linkUrl: string | null; isFeatured: boolean; publishedAt: string;
};
export type NewsArticle = NewsSummary & { body: string };
// Vue de gestion : un brouillon n'a pas encore de date de publication.
export type NewsAdminArticle = Omit<NewsArticle, "publishedAt"> & {
  publishedAt: string | null; isPublished: boolean; isArchived: boolean;
};

export type NewsPage = {
  featured: NewsSummary | null;
  latest: NewsSummary[];
  officialAnnouncements: NewsSummary[];
  conferences: NewsSummary[];
  publications: NewsSummary[];
  results: NewsSummary[];
  activities: NewsSummary[];
  archiveCount: number;
};
export type NewsArchives = { items: NewsSummary[]; total: number; page: number; limit: number; years: number[] };

const FILES_BASE = API_BASE.replace(/\/api\/?$/, "");
export const newsImage = (url: string | null) => (url ? (url.startsWith("http") ? url : `${FILES_BASE}${url}`) : null);

export const fmtNewsDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
export const fmtNewsDateTime = (d: string) =>
  new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
