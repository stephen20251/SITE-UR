import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, RotateCcw, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

type Version = {
  id: string;
  versionNum: number;
  label: string;
  createdAt: string;
  creator: { firstName: string; lastName: string };
};

export function VersionHistory({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["course-versions", courseId],
    queryFn: () => api<Version[]>(`/online/studio/courses/${courseId}/versions`),
  });

  const saveVersion = useMutation({
    mutationFn: (lbl: string) =>
      api<Version>(`/online/studio/courses/${courseId}/versions`, { method: "POST", body: { label: lbl || undefined } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course-versions", courseId] });
      setLabel("");
      toast.success("Version sauvegardée");
    },
    onError: () => toast.error("Erreur"),
  });

  const restoreVersion = useMutation({
    mutationFn: (versionNum: number) =>
      api(`/online/studio/courses/${courseId}/versions/${versionNum}/restore`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course-versions", courseId] });
      qc.invalidateQueries({ queryKey: ["online", "course", courseId] });
      toast.success("Version restaurée ! Rechargez la page pour voir les changements.");
    },
    onError: () => toast.error("Erreur lors de la restauration"),
  });

  return (
    <div className="max-w-xl space-y-4">
      {/* Save new version */}
      <div className="flex gap-2">
        <input value={label} onChange={e => setLabel(e.target.value)}
          className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="Label de version (optionnel)" />
        <button onClick={() => saveVersion.mutate(label)} disabled={saveVersion.isPending}
          className="flex items-center gap-2 rounded-lg grad-online px-4 text-sm font-medium text-white disabled:opacity-60">
          {saveVersion.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Sauvegarder
        </button>
      </div>

      {/* Version list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : versions.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Clock className="mx-auto mb-2 h-8 w-8 opacity-30" />
          Aucune version sauvegardée.<br />Sauvegardez une version avant de publier pour pouvoir restaurer ultérieurement.
        </div>
      ) : (
        <div className="space-y-2">
          {versions.map(v => (
            <div key={v.id} className="flex items-center gap-3 rounded-xl border bg-card p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-online/10">
                <span className="text-sm font-semibold text-online">v{v.versionNum}</span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{v.label}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(v.createdAt).toLocaleString("fr")} · par {v.creator.firstName} {v.creator.lastName}
                </div>
              </div>
              <button
                onClick={() => { if (confirm(`Restaurer "${v.label}" ? L'état actuel sera sauvegardé automatiquement.`)) restoreVersion.mutate(v.versionNum); }}
                disabled={restoreVersion.isPending}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Restaurer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
