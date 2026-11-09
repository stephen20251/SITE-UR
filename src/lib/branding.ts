import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ORIGIN } from "@/lib/env";

export type SchoolBranding = {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  logoUrl: string | null;
  secondaryLogoUrl: string | null;
  backgroundUrl: string | null;
  watermarkUrl: string | null;
  stampUrl: string | null;
  signatureUrl: string | null;
  iconUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  updatedAt: string;
};

const QK = ["branding"] as const;

export function useBranding() {
  return useQuery<SchoolBranding>({
    queryKey: QK,
    queryFn: () => api<SchoolBranding>("/branding"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SchoolBranding>) =>
      api<SchoolBranding>("/branding", { method: "PATCH", body: data }),
    onSuccess: (updated) => {
      qc.setQueryData(QK, updated);
    },
  });
}

export function useUploadBrandingAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ field, file }: { field: string; file: File }) => {
      const BASE = API_ORIGIN;
      const token = localStorage.getItem("us.accessToken") ?? "";
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BASE}/api/branding/upload/${field}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Upload échoué");
      }
      return res.json() as Promise<{ url: string; branding: SchoolBranding }>;
    },
    onSuccess: ({ branding }) => {
      qc.setQueryData(QK, branding);
    },
  });
}

// Helper: resolve a branding URL to a full absolute URL for display
const BASE = API_ORIGIN;
export function brandingUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${BASE}${path}`;
}
