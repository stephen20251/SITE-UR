// Événements de l'université (section « Actualité » de l'accueil, gérés dans /classroom/evenements).
import { API_BASE } from "./api";

export type UniversityEvent = {
  id: string; title: string; description: string | null; location: string | null;
  startAt: string; endAt: string | null; imageUrl: string | null; isPublished: boolean;
};

const FILES_BASE = API_BASE.replace(/\/api\/?$/, "");
export const eventImage = (url: string | null) => (url ? (url.startsWith("http") ? url : `${FILES_BASE}${url}`) : null);
