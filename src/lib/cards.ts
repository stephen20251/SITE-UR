import { useQuery } from "@tanstack/react-query";
import { api, tokenStore } from "./api";
import { API_ORIGIN } from "@/lib/env";

export type CardTemplate = {
  id: string;
  name: string;
  thumbnail: string; // color or gradient CSS value
  style: string;
};

export type CardResult = {
  recto: string; // HTML string
  verso: string;
  student: Record<string, string>;
};

export type BulkCardResult = {
  id: string;
  name: string;
  recto: string;
  verso: string;
};

const BASE = API_ORIGIN;

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${tokenStore.access ?? ""}` };
}

export function useCardTemplates() {
  return useQuery({
    queryKey: ["cards", "templates"],
    queryFn: () => api<CardTemplate[]>("/cards/templates"),
  });
}

export async function previewCard(templateId: string, studentId: string): Promise<CardResult> {
  const r = await fetch(`${BASE}/api/cards/preview/${templateId}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ studentId }),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as { error?: string }).error ?? "Erreur"); }
  return r.json();
}

export async function generateCard(templateId: string, studentId: string): Promise<CardResult> {
  const r = await fetch(`${BASE}/api/cards/generate/${templateId}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ studentId }),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as { error?: string }).error ?? "Erreur"); }
  return r.json();
}

export async function generateBulkCards(templateId: string, studentIds: string[]): Promise<BulkCardResult[]> {
  const r = await fetch(`${BASE}/api/cards/generate-bulk/${templateId}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ studentIds }),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as { error?: string }).error ?? "Erreur"); }
  return r.json();
}
