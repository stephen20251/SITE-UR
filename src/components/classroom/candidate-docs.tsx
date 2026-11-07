// Pièce jointe d'un dossier de candidature : dépôt, aperçu sécurisé, état de vérification.
import { useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, Download, Eye, FileText, Loader2, Trash2, Upload, XCircle } from "lucide-react";
import { ApiError } from "@/lib/api";
import { candidateDocUrl, useDeleteCandidateDoc, useUploadCandidateDoc, type CandidateDocument } from "@/lib/candidatures";

export const REVIEW_BADGE: Record<CandidateDocument["reviewStatus"], { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  PENDING:  { label: "En attente de vérification", cls: "bg-amber-100 text-amber-700", Icon: Clock },
  VERIFIED: { label: "Vérifiée", cls: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2 },
  REJECTED: { label: "À corriger", cls: "bg-red-100 text-red-700", Icon: XCircle },
};

export async function openCandidateDoc(doc: CandidateDocument) {
  try {
    const url = await candidateDocUrl(doc.id);
    window.open(url, "_blank", "noopener");
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Impossible d'ouvrir la pièce");
  }
}

export function DocSlot({ type, label, doc, editable, required, template }: {
  type: string; label: string; doc?: CandidateDocument; editable: boolean; required?: boolean;
  template?: { href: string; label: string };
}) {
  const upload = useUploadCandidateDoc();
  const del = useDeleteCandidateDoc();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // Une pièce refusée peut toujours être renvoyée
  const canUpload = editable || doc?.reviewStatus === "REJECTED";

  async function onFile(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      await upload.mutateAsync({ type, file: f });
      toast.success("Pièce déposée");
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "Dépôt impossible"); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }

  const badge = doc ? REVIEW_BADGE[doc.reviewStatus] : null;
  return (
    <div className={`rounded-xl border p-3 ${doc?.reviewStatus === "REJECTED" ? "border-red-300 bg-red-50/50" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-classroom" />
        <span className="flex-1 text-sm font-medium">{label}{required && <span className="text-red-500"> *</span>}</span>
        {badge && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
            <badge.Icon className="h-3 w-3" /> {badge.label}
          </span>
        )}
      </div>
      {template && (
        <a href={template.href} download className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-classroom hover:underline">
          <Download className="h-3 w-3" /> {template.label}
        </a>
      )}
      {doc?.reviewStatus === "REJECTED" && doc.reviewNote && <p className="mt-1 text-xs text-red-700">Motif : {doc.reviewNote}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {doc ? (
          <button onClick={() => openCandidateDoc(doc)} className="inline-flex max-w-[60%] items-center gap-1 truncate rounded-lg border px-2 py-1 text-xs hover:bg-accent">
            <Eye className="h-3 w-3" /> {doc.name}
          </button>
        ) : <span className="text-xs text-muted-foreground">Aucun fichier déposé</span>}
        {canUpload && (
          <>
            <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <button onClick={() => input.current?.click()} disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg grad-classroom px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} {doc ? "Remplacer" : "Déposer"}
            </button>
          </>
        )}
        {doc && editable && (
          <button onClick={() => del.mutate(doc.id)} className="rounded-lg p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
        )}
      </div>
    </div>
  );
}
