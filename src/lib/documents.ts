import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "./api";

export type DocumentInput = {
  key: string;
  type: "student" | "teacher" | "semester" | "payment" | "text" | "date" | "textarea";
  label: string;
};

export type DocumentTemplate = {
  id: string;
  name: string;
  category: "ETUDIANT" | "ENSEIGNANT" | "ADMINISTRATION";
  icon: string;
  description: string;
  allowedRoles: string[];
  requiredInputs: DocumentInput[];
};

export const CATEGORY_LABELS: Record<string, string> = {
  ETUDIANT:       "Étudiant",
  ENSEIGNANT:     "Enseignant",
  ADMINISTRATION: "Administration",
};

export const CATEGORY_COLORS: Record<string, string> = {
  ETUDIANT:       "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300",
  ENSEIGNANT:     "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300",
  ADMINISTRATION: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300",
};

export function useDocumentTemplates() {
  return useQuery({
    queryKey: ["documents", "templates"],
    queryFn: () => api<DocumentTemplate[]>("/documents/templates"),
  });
}

export function useDocumentTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ["documents", "templates", id],
    queryFn: () => api<DocumentTemplate>(`/documents/templates/${id}`),
    enabled: !!id,
  });
}

export function useGenerateDocument() {
  return useMutation({
    mutationFn: ({ templateId, inputs }: { templateId: string; inputs: Record<string, string> }) =>
      fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}/api/documents/generate/${templateId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("us.accessToken") ?? ""}`,
        },
        body: JSON.stringify(inputs),
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ message: "Erreur inconnue" }));
          throw new Error(err.message ?? "Erreur de génération");
        }
        return r.text();
      }),
  });
}
