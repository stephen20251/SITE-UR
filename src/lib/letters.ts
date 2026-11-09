import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, tokenStore } from "./api";
import { API_ORIGIN } from "@/lib/env";

export type LetterInput = {
  key: string;
  type: "student" | "teacher" | "staff" | "semester" | "text" | "textarea" | "datetime-local";
  label: string;
};

export type LetterTemplate = {
  id: string;
  name: string;
  category: "ETUDIANT" | "ENSEIGNANT" | "PERSONNEL";
  icon: string;
  description: string;
  allowedRoles: string[];
  requiredInputs: LetterInput[];
  signatoryRoles: string[];
  body: string;
};

export type GeneratedDoc = {
  id: string;
  number: string;
  templateName: string;
  category: string;
  moduleType: string;
  recipientName: string;
  recipientType: string;
  generatedAt: string;
  status: string;
  author: { firstName: string; lastName: string };
};

const BASE = API_ORIGIN;

export const LETTER_CATEGORY_LABELS: Record<string, string> = {
  ETUDIANT:  "Étudiants",
  ENSEIGNANT: "Enseignants",
  PERSONNEL: "Personnel",
};

export const LETTER_CATEGORY_COLORS: Record<string, string> = {
  ETUDIANT:  "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300",
  ENSEIGNANT: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300",
  PERSONNEL: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300",
};

export function useLetterTemplates() {
  return useQuery({
    queryKey: ["letters", "templates"],
    queryFn: () => api<LetterTemplate[]>("/letters/templates"),
  });
}

export async function previewLetter(templateId: string, inputs: Record<string, string>): Promise<string> {
  const r = await fetch(`${BASE}/api/letters/preview/${templateId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenStore.access ?? ""}` },
    body: JSON.stringify(inputs),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as { error?: string }).error ?? "Erreur"); }
  return r.text();
}

export async function generateLetter(templateId: string, inputs: Record<string, string>): Promise<string> {
  const r = await fetch(`${BASE}/api/letters/generate/${templateId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenStore.access ?? ""}` },
    body: JSON.stringify(inputs),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as { error?: string }).error ?? "Erreur"); }
  return r.text();
}

export function useLetterHistory(page = 1) {
  return useQuery({
    queryKey: ["letters", "history", page],
    queryFn: () => api<{ total: number; items: GeneratedDoc[] }>(`/letters/history?moduleType=LETTER&page=${page}&limit=20`),
  });
}

export function useArchivedLetter(id: string | null) {
  return useQuery({
    queryKey: ["letters", "history", id],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/letters/history/${id}?html=1`, {
        headers: { Authorization: `Bearer ${tokenStore.access ?? ""}` },
      });
      return r.text();
    },
    enabled: !!id,
  });
}
