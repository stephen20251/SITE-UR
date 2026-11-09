// Corps enseignant : dossier académique et CV des enseignants.
// Les CV sont privés : ils passent par des requêtes authentifiées, jamais par une URL publique.
import { useQuery } from "@tanstack/react-query";
import { api, API_BASE, ApiError, refreshAccessToken, tokenStore } from "./api";

export type AcademicTitle = "PROFESSEUR" | "DOCTEUR";

export const ACADEMIC_TITLES: { value: AcademicTitle; label: string }[] = [
  { value: "PROFESSEUR", label: "Professeur" },
  { value: "DOCTEUR", label: "Docteur" },
];
export const titleLabel = (t?: AcademicTitle | null) => ACADEMIC_TITLES.find((x) => x.value === t)?.label ?? null;

export type FacultyMember = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  academicTitle: AcademicTitle;
  highestDegree: string | null;
  yearsExperience: number | null;
  specialization: string | null;
  bio: string | null;
  cvUpdatedAt: string | null;
  mention: { id: string; name: string } | null;
  courses: { id: string; title: string }[];
};

export const useFaculty = (enabled = true) =>
  useQuery({ queryKey: ["faculty"], queryFn: () => api<FacultyMember[]>("/faculty"), enabled, retry: false });

// Ouvre le CV dans un nouvel onglet. La fenêtre est créée avant la requête :
// ouverte après coup, elle serait bloquée par le navigateur.
export async function openCv(path: string) {
  const tab = window.open("", "_blank");
  try {
    const send = (token: string | null) => fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    let res = await send(tokenStore.access);
    if (res.status === 401) res = await send(await refreshAccessToken());
    if (!res.ok) throw new ApiError(res.status, "Impossible d'ouvrir le CV");
    const url = URL.createObjectURL(await res.blob());
    if (tab) {
      tab.location.href = url;
    } else {
      // Fenêtre bloquée par le navigateur : le CV est téléchargé à la place.
      const link = document.createElement("a");
      link.href = url;
      link.download = "cv.pdf";
      link.click();
    }
  } catch (e) {
    tab?.close();
    throw e;
  }
}
