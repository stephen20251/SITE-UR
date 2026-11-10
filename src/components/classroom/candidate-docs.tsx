// Pièce jointe d'un dossier de candidature : dépôt, aperçu sécurisé, état de vérification.
// Une pièce peut compter plusieurs fichiers (ex. CIN recto et verso).
import { useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, Download, Eye, FileText, Loader2, Plus, Trash2, Upload, XCircle } from "lucide-react";
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

export function DocSlot({ type, label, docs, editable, required, template, maxFiles = 1, hint }: {
  type: string; label: string; docs: CandidateDocument[]; editable: boolean; required?: boolean;
  template?: { href: string; label: string }; maxFiles?: number; hint?: string;
}) {
  const upload = useUploadCandidateDoc();
  const del = useDeleteCandidateDoc();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const rejected = docs.some((d) => d.reviewStatus === "REJECTED");
  // Une pièce refusée peut toujours être renvoyée
  const canUpload = editable || rejected;
  const multi = maxFiles > 1;
  // Fichiers refusés remplacés au prochain dépôt : ils ne comptent pas dans la limite.
  const kept = multi ? docs.filter((d) => d.reviewStatus !== "REJECTED").length : 0;
  const canAdd = canUpload && (!multi || kept < maxFiles);

  async function onFiles(list: FileList | null) {
    const files = Array.from(list ?? []).slice(0, multi ? Math.max(maxFiles - kept, 1) : 1);
    if (!files.length) return;
    setBusy(true);
    try {
      for (const file of files) await upload.mutateAsync({ type, file });
      toast.success(files.length > 1 ? `${files.length} fichiers déposés` : "Fichier déposé");
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "Dépôt impossible"); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }

  // État global de la pièce : à corriger > en attente > vérifiée
  const status: CandidateDocument["reviewStatus"] | null = !docs.length ? null
    : rejected ? "REJECTED" : docs.some((d) => d.reviewStatus === "PENDING") ? "PENDING" : "VERIFIED";
  const badge = status ? REVIEW_BADGE[status] : null;
  const pageName = (i: number) => (docs.length > 1 || multi ? (i === 0 ? "Recto / page 1" : i === 1 ? "Verso / page 2" : `Page ${i + 1}`) : null);

  return (
    <div className={`rounded-xl border p-3 ${rejected ? "border-red-300 bg-red-50/50" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-classroom" />
        <span className="flex-1 text-sm font-medium">{label}{required && <span className="text-red-500"> *</span>}</span>
        {badge && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
            <badge.Icon className="h-3 w-3" /> {badge.label}
          </span>
        )}
      </div>
      {hint && <p className="mt-0.5 pl-6 text-xs text-muted-foreground">{hint}{multi && ` — ${maxFiles} fichiers maximum`}</p>}
      {template && (
        <a href={template.href} download className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-classroom hover:underline">
          <Download className="h-3 w-3" /> {template.label}
        </a>
      )}

      {docs.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {docs.map((doc, i) => (
            <li key={doc.id} className="flex flex-wrap items-center gap-2">
              {pageName(i) && <span className="w-24 shrink-0 text-[11px] text-muted-foreground">{pageName(i)}</span>}
              <button onClick={() => openCandidateDoc(doc)} className="inline-flex min-w-0 max-w-[55%] items-center gap-1 rounded-lg border px-2 py-1 text-xs hover:bg-accent">
                <Eye className="h-3 w-3 shrink-0" /> <span className="truncate">{doc.name}</span>
              </button>
              {multi && doc.reviewStatus !== "PENDING" && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${REVIEW_BADGE[doc.reviewStatus].cls}`}>{REVIEW_BADGE[doc.reviewStatus].label}</span>
              )}
              {editable && (
                <button onClick={() => del.mutate(doc.id)} aria-label={`Retirer ${doc.name}`}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
              )}
              {doc.reviewStatus === "REJECTED" && doc.reviewNote && <p className="w-full text-xs text-red-700">Motif : {doc.reviewNote}</p>}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!docs.length && <span className="text-xs text-muted-foreground">Aucun fichier déposé</span>}
        {canAdd && (
          <>
            <input ref={input} type="file" multiple={multi} accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="hidden" onChange={(e) => onFiles(e.target.files)} />
            <button onClick={() => input.current?.click()} disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg grad-classroom px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : multi && docs.length ? <Plus className="h-3 w-3" /> : <Upload className="h-3 w-3" />}
              {multi ? (rejected ? "Renvoyer" : docs.length ? "Ajouter un fichier" : "Déposer (recto, verso…)") : docs.length ? "Remplacer" : "Déposer"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
