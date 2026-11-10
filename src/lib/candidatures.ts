// Candidatures : dossier du candidat (/candidates/my) et traitement par le secrétariat.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_BASE, tokenStore } from "./api";

export type CandidateStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED" | "ENROLLED";
export type CandidateDocument = {
  id: string; type: string; name: string; mimeType: string | null; stage: "PRE_INSCRIPTION" | "INSCRIPTION";
  reviewStatus: "PENDING" | "VERIFIED" | "REJECTED"; reviewNote: string | null; uploadedAt: string;
};
export type InscriptionForm = Record<string, string | boolean | undefined>;
export type Candidate = {
  id: string; userId: string; status: CandidateStatus; level: string | null; notes: string | null;
  documents: CandidateDocument[];
  motivation: Record<string, string> | null;
  inscriptionForm: InscriptionForm | null;
  paymentReference: string | null; fromOtherSchool: boolean; inscriptionSubmittedAt: string | null;
  submittedAt: string | null; reviewedAt: string | null; rejectionReason: string | null; createdAt: string;
  mention: { id: string; name: string; code: string } | null;
  user: { id: string; email: string; firstName: string; lastName: string; phone: string | null; createdAt: string };
};

export const CANDIDATE_STATUS: Record<CandidateStatus, { label: string; cls: string }> = {
  DRAFT: { label: "Brouillon", cls: "bg-muted text-muted-foreground" },
  SUBMITTED: { label: "Soumis", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  UNDER_REVIEW: { label: "En examen", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  ACCEPTED: { label: "Accepté", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  REJECTED: { label: "Refusé", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  ENROLLED: { label: "Inscrit", cls: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
};

const inv = (qc: ReturnType<typeof useQueryClient>) => () => qc.invalidateQueries({ queryKey: ["candidates"] });

// ─── Candidat ────────────────────────────────────────────────────────────────
export const useMyCandidature = (enabled = true) =>
  useQuery({ queryKey: ["candidates", "my"], queryFn: () => api<Candidate>("/candidates/my"), enabled, retry: false,
    refetchInterval: 30_000, refetchOnWindowFocus: true });

export function useUpdateMyCandidature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { mentionId?: string; level?: string; notes?: string; phone?: string }) =>
      api<Candidate>("/candidates/my/mention", { method: "PUT", body: b }),
    onSuccess: inv(qc),
  });
}
export function useSubmitMyCandidature() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api<Candidate>("/candidates/my/submit", { method: "PUT" }), onSuccess: inv(qc) });
}

// ─── Secrétariat ─────────────────────────────────────────────────────────────
export const useCandidates = (f: { status?: string; search?: string }) =>
  useQuery({
    queryKey: ["candidates", "list", f],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "100" });
      if (f.status) p.set("status", f.status);
      if (f.search) p.set("search", f.search);
      return api<{ total: number; candidates: Candidate[] }>(`/candidates?${p}`);
    },
  });

export function useCandidateAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "review" | "accept" | "reject"; reason?: string }) =>
      api<Candidate>(`/candidates/${id}/${action}`, { method: "PUT", body: action === "reject" ? { reason } : {} }),
    onSuccess: inv(qc),
  });
}
export function useEnrollCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, promotionId, groupId, studyMode }: { id: string; promotionId: string; groupId?: string; studyMode: "PRESENTIEL" | "EN_LIGNE" }) =>
      api<{ matricule: string }>(`/candidates/${id}/enroll`, { method: "POST", body: { promotionId, groupId, studyMode } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["candidates"] }); qc.invalidateQueries({ queryKey: ["inscriptions"] }); },
  });
}

export type PromotionOption = { id: string; name: string; level: string; mentionId: string };
export const usePromotionOptions = (mentionId?: string | null) =>
  useQuery({
    queryKey: ["structure", "promotions", mentionId ?? ""],
    queryFn: () => api<PromotionOption[]>(`/structure/promotions${mentionId ? `?mentionId=${mentionId}` : ""}`),
  });
export const useGroupOptions = (promotionId?: string) =>
  useQuery({
    queryKey: ["structure", "groups", promotionId ?? ""],
    queryFn: () => api<{ id: string; name: string }[]>(`/structure/promotions/${promotionId}/groups`),
    enabled: !!promotionId,
  });
export const usePublicMentions = () =>
  useQuery({ queryKey: ["auth", "mentions"], queryFn: () => api<{ id: string; name: string }[]>("/auth/mentions", { auth: false }) });

// ─── Dossier (pièces, questionnaire, inscription) ────────────────────────────
export type DossierMeta = {
  docTypes: Record<string, { stage: "PRE_INSCRIPTION" | "INSCRIPTION"; label: string; required?: boolean; otherSchool?: boolean; maxFiles?: number; hint?: string }>;
  questions: { key: string; label: string }[];
  requiredFormFields: [string, string][];
};
export const useDossierMeta = () =>
  useQuery({ queryKey: ["candidates", "meta"], queryFn: () => api<DossierMeta>("/candidates/meta"), staleTime: Infinity });

export function useUploadCandidateDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, file }: { type: string; file: File }) => {
      const fd = new FormData();
      fd.append("type", type);
      fd.append("file", file);
      return api<CandidateDocument>("/candidates/my/documents", { method: "POST", body: fd, raw: true });
    },
    onSuccess: inv(qc),
  });
}
export function useDeleteCandidateDoc() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api(`/candidates/my/documents/${id}`, { method: "DELETE" }), onSuccess: inv(qc) });
}
export function useSaveMotivation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (answers: Record<string, string>) => api("/candidates/my/motivation", { method: "PUT", body: { answers } }),
    onSuccess: inv(qc),
  });
}
export function useSaveInscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { form?: InscriptionForm; paymentReference?: string; fromOtherSchool?: boolean }) =>
      api("/candidates/my/inscription", { method: "PUT", body: b }),
    onSuccess: inv(qc),
  });
}
export function useSubmitInscription() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api("/candidates/my/inscription/submit", { method: "POST" }), onSuccess: inv(qc) });
}
export function useReviewDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ candidateId, docId, status, note }: { candidateId: string; docId: string; status: "VERIFIED" | "REJECTED" | "PENDING"; note?: string }) =>
      api(`/candidates/${candidateId}/documents/${docId}/review`, { method: "PUT", body: { status, note } }),
    onSuccess: inv(qc),
  });
}
export function useReturnInscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => api(`/candidates/${id}/inscription/return`, { method: "PUT", body: { reason } }),
    onSuccess: inv(qc),
  });
}

// Les pièces sont protégées : on les récupère avec le jeton puis on crée une URL locale
export async function candidateDocUrl(docId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/candidates/documents/${docId}/file`, {
    headers: tokenStore.access ? { Authorization: `Bearer ${tokenStore.access}` } : {},
  });
  if (!res.ok) throw new Error("Impossible d'ouvrir la pièce");
  return URL.createObjectURL(await res.blob());
}
