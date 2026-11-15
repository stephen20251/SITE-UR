import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarRange, Plus } from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";
import { Card, Empty, Loading, PageHeader, btnPrimary, inputCls } from "@/components/classroom/cursus-ui";
import { SemestersPanel } from "@/components/classroom/semesters";
import { api, ApiError } from "@/lib/api";
import type { CursusSemester } from "@/lib/cursus";

export const Route = createFileRoute("/classroom/semestres")({ component: SemestresPage });

type AllSemesters = {
  mention: { id: string; name: string; code: string };
  levels: { level: string; semesters: CursusSemester[] }[];
};

// Semestres du cursus en présentiel : chaque mention a les siens (S1 à S10 de L1 à M2
// par défaut), avec ses propres noms et ses propres mois. Le Super Admin choisit la
// mention ; un Responsable pédagogique ne voit que la sienne.
function SemestresPage() {
  const { user, ready } = useRequireClassroom(["STAFF", "SUPER_ADMIN"]);
  const qc = useQueryClient();
  const mentions = useQuery({
    queryKey: ["structure", "mentions", "mine"],
    queryFn: () => api<{ id: string; name: string }[]>("/structure/mentions?mine=1"),
    enabled: ready && !!user,
  });
  const [mentionId, setMentionId] = useState("");
  useEffect(() => {
    if (!mentionId && mentions.data?.[0]) setMentionId(mentions.data[0].id);
  }, [mentions.data, mentionId]);

  const all = useQuery({
    queryKey: ["cursus", "semesters-all", mentionId],
    queryFn: () => api<AllSemesters>(`/cursus/semesters/all?mentionId=${mentionId}`),
    enabled: !!mentionId,
  });
  const initAll = useMutation({
    mutationFn: () => api<AllSemesters>("/cursus/semesters/init-all", { method: "POST", body: { mentionId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cursus"] }); toast.success("Semestres S1 à S10 créés : renommez-les ou changez leurs mois"); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Échec"),
  });

  if (!ready || !user || mentions.isLoading) return <Loading />;
  if (!mentions.data?.length) {
    return <Empty>Aucune mention n'est rattachée à votre compte : demandez au Super Admin de vous associer à votre mention.</Empty>;
  }
  const mentionName = mentions.data.find((m) => m.id === mentionId)?.name ?? "";
  const allDefault = all.data?.levels.every((l) => l.semesters.every((s) => s.isDefault)) ?? false;
  const count = all.data?.levels.reduce((n, l) => n + l.semesters.length, 0) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Semestres"
        subtitle="Chaque mention organise ses propres semestres, de L1 à M2 : noms, mois couverts et cours. Ils ne s'affichent jamais dans une autre mention."
        actions={mentions.data.length > 1 && (
          <select className={inputCls} value={mentionId} onChange={(e) => setMentionId(e.target.value)} aria-label="Mention">
            {mentions.data.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
      />

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl grad-classroom text-white"><CalendarRange className="h-5 w-5" /></div>
          <div>
            <div className="font-semibold">Mention {mentionName}</div>
            <div className="text-xs text-muted-foreground">
              {count} semestre{count > 1 ? "s" : ""} · par défaut S1–S2 en L1, S3–S4 en L2, S5–S6 en L3, S7–S8 en M1, S9–S10 en M2
            </div>
          </div>
        </div>
        {allDefault && (
          <button className={btnPrimary} disabled={initAll.isPending} onClick={() => initAll.mutate()}>
            <Plus className="h-4 w-4" /> Créer les semestres S1 à S10 de cette mention
          </button>
        )}
      </Card>

      {all.isLoading ? <Loading /> : !all.data ? <Empty>Impossible de charger les semestres.</Empty> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {all.data.levels.map((l) => (
            <SemestersPanel key={l.level} mentionId={mentionId} level={l.level} semesters={l.semesters} />
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Les cours se placent dans les semestres depuis « Cursus universitaire » (chaque cours est rangé dans un mois du semestre ; l'écolage reste mensuel).
      </p>
    </div>
  );
}
