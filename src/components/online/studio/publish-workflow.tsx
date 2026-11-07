import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, X, Loader2, ChevronRight, Clock, Globe, Archive, AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { CourseDetail } from "@/lib/online";
import { QualityChecklist } from "./quality-checklist";

type Status = "DRAFT" | "REVIEW" | "APPROVED" | "PUBLISHED" | "ARCHIVED";

const WORKFLOW: { status: Status; label: string; desc: string }[] = [
  { status: "DRAFT",     label: "Brouillon",   desc: "Cours en cours de création" },
  { status: "REVIEW",    label: "En validation", desc: "Soumis au Responsable de la mention et au Super Admin" },
  { status: "APPROVED",  label: "Validé",        desc: "Validé par le Responsable de la mention ou le Super Admin" },
  { status: "PUBLISHED", label: "Publié",       desc: "Visible par les apprenants" },
  { status: "ARCHIVED",  label: "Archivé",      desc: "Cours désactivé" },
];

const STATUS_COLOR: Record<Status, string> = {
  DRAFT:     "bg-yellow-500/10 text-yellow-700 border-yellow-300",
  REVIEW:    "bg-blue-500/10 text-blue-700 border-blue-300",
  APPROVED:  "bg-purple-500/10 text-purple-700 border-purple-300",
  PUBLISHED: "bg-green-500/10 text-green-700 border-green-300",
  ARCHIVED:  "bg-muted text-muted-foreground border-border",
};

const VALID_TRANSITIONS: Record<Status, Status[]> = {
  DRAFT:     ["REVIEW"],
  REVIEW:    ["PUBLISHED", "DRAFT"],
  APPROVED:  ["PUBLISHED", "DRAFT"],
  PUBLISHED: ["ARCHIVED", "DRAFT"],
  ARCHIVED:  ["DRAFT"],
};
// Libellés des actions (la validation d'un cours soumis = « valider et publier »).
const ACTION_LABEL: Partial<Record<string, { label: string; desc: string }>> = {
  "DRAFT>REVIEW": { label: "Soumettre à validation", desc: "Le Responsable de la mention ou le Super Admin validera la publication" },
  "REVIEW>PUBLISHED": { label: "Valider et publier", desc: "Réservé au Responsable de la mention et au Super Admin" },
  "REVIEW>DRAFT": { label: "Retirer de la validation", desc: "Revenir en brouillon pour continuer les modifications" },
};

export function PublishWorkflow({
  course,
  onGoToTab,
}: {
  course: CourseDetail;
  onGoToTab: (tab: string) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const isSuperAdmin = user?.systemRole === "SUPER_ADMIN";

  const currentStatus = course.status as Status;
  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
  const history: Array<{ status: string; changedAt: string; note: string | null }> = (course as any).statusHistory ?? [];

  const transition = useMutation({
    mutationFn: ({ status, note }: { status: Status; note?: string }) =>
      api(`/online/studio/courses/${course.id}/transition`, { method: "POST", body: { status, note } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["online", "course", course.id] });
      setNote("");
      toast.success("Statut mis à jour");
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  // Quality score
  const qChecks = [
    !!course.title, (course.description ?? "").length > 50, !!course.thumbnail,
    (course.modules ?? []).length > 0, (course.modules ?? []).some(m => (m.lessons ?? []).length > 0),
    !!course.category, !!course.level, (course.objectives ?? []).length > 0,
  ];
  const qScore = Math.round((qChecks.filter(Boolean).length / qChecks.length) * 100);
  const canSubmit = qScore >= 70;

  return (
    <div className="max-w-xl space-y-6">
      {/* Current status */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-semibold">Statut actuel</span>
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_COLOR[currentStatus]}`}>
            {WORKFLOW.find(w => w.status === currentStatus)?.label ?? currentStatus}
          </span>
        </div>

        {/* Timeline */}
        <div className="flex items-center gap-0 overflow-x-auto pb-1">
          {WORKFLOW.filter(w => w.status !== "ARCHIVED").map((w, i, arr) => {
            const idx = WORKFLOW.findIndex(x => x.status === currentStatus);
            const wIdx = WORKFLOW.findIndex(x => x.status === w.status);
            const isPast = wIdx < idx;
            const isCurrent = w.status === currentStatus;
            return (
              <div key={w.status} className="flex items-center">
                <div className={`flex flex-col items-center gap-1 w-20 ${isCurrent ? "opacity-100" : isPast ? "opacity-70" : "opacity-30"}`}>
                  <div className={`h-7 w-7 rounded-full grid place-items-center border-2 text-xs
                    ${isCurrent ? "border-online bg-online text-white" : isPast ? "border-green-500 bg-green-500/10 text-green-600" : "border-muted bg-background text-muted-foreground"}`}>
                    {isPast ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span className="text-[9px] text-center leading-tight text-muted-foreground">{w.label}</span>
                </div>
                {i < arr.length - 1 && (
                  <div className={`h-0.5 w-8 shrink-0 ${wIdx < idx ? "bg-green-500" : "bg-muted"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Validation en attente / commentaire du valideur */}
      {currentStatus === "REVIEW" && (
        <div className="flex gap-2 rounded-xl border border-blue-300 bg-blue-500/5 p-4 text-sm">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <span>En attente de validation par le <b>Responsable de la mention</b> ou le <b>Super Admin</b>. Vous serez notifié(e) de leur décision.</span>
        </div>
      )}
      {currentStatus === "DRAFT" && (course as { reviewNote?: string | null }).reviewNote && (
        <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-500/5 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span><b>Commentaire du valideur :</b> {(course as { reviewNote?: string | null }).reviewNote}</span>
        </div>
      )}

      {/* Quality score */}
      {currentStatus === "DRAFT" && (
        <div className={`rounded-xl border p-4 ${canSubmit ? "border-green-300 bg-green-500/5" : "border-yellow-300 bg-yellow-500/5"}`}>
          <div className="flex items-center gap-2">
            {canSubmit
              ? <Check className="h-4 w-4 text-green-600" />
              : <AlertCircle className="h-4 w-4 text-yellow-600" />}
            <span className="text-sm font-medium">Score qualité : {qScore}%</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {canSubmit
              ? "Le cours est prêt à être soumis en révision."
              : "Complétez au moins 70% de la checklist avant de soumettre."}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold">Transitions disponibles</h3>

        {/* Note field */}
        {allowed.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Note (optionnelle)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              rows={2} className="h-auto w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-ring"
              placeholder="Commentaire sur ce changement de statut…" />
          </div>
        )}

        <div className="space-y-2">
          {allowed.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune transition disponible depuis ce statut.</p>
          )}
          {allowed.map(target => {
            const w = ACTION_LABEL[`${currentStatus}>${target}`] ?? WORKFLOW.find(x => x.status === target);
            // Valider un cours soumis : Responsable de la mention ou Super Admin (vérifié côté serveur).
            const needsAdmin = currentStatus === "REVIEW" && target === "PUBLISHED";
            const disabled = transition.isPending || (needsAdmin && !isSuperAdmin) || (target === "REVIEW" && !canSubmit);
            return (
              <button key={target} onClick={() => transition.mutate({ status: target, note: note || undefined })}
                disabled={disabled}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm text-left transition disabled:opacity-50
                  ${target === "PUBLISHED" ? "border-green-300 hover:bg-green-500/5" : target === "ARCHIVED" ? "border-destructive/30 hover:bg-destructive/5" : "hover:bg-accent"}`}>
                {transition.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  target === "PUBLISHED" ? <Globe className="h-4 w-4 text-green-600" /> :
                  target === "ARCHIVED" ? <Archive className="h-4 w-4 text-destructive" /> :
                  target === "APPROVED" ? <ShieldCheck className="h-4 w-4 text-purple-600" /> :
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <div className="flex-1">
                  <div className="font-medium">{w?.label ?? target}</div>
                  <div className="text-xs text-muted-foreground">{w?.desc}</div>
                </div>
                {needsAdmin && !isSuperAdmin && (
                  <span className="text-xs text-muted-foreground">Validation requise</span>
                )}
                {target === "REVIEW" && !canSubmit && (
                  <span className="text-xs text-yellow-600">Score insuffisant</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Checklist */}
      <QualityChecklist course={course} onGoToTab={onGoToTab} />

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold">Historique des transitions</h3>
          <div className="space-y-2">
            {[...history].reverse().map((h, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div>
                  <span className="font-medium">{h.status}</span>
                  <span className="text-muted-foreground ml-2">{new Date(h.changedAt).toLocaleString("fr")}</span>
                  {h.note && <p className="mt-0.5 text-muted-foreground">{h.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
