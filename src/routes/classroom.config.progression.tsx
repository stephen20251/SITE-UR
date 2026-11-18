import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { useProgressRules, useRecomputeProgress, useSaveProgressRules, type ProgressRules } from "@/lib/online";
import { ApiError } from "@/lib/api";

// Configuration → Progression des cours : règles appliquées dans l'espace étudiant
// (cours terminé, quiz et devoirs, déblocage des mois, affichage).
export const Route = createFileRoute("/classroom/config/progression")({ component: ProgressionPage });

const box = "rounded-2xl border bg-card p-5 shadow-elegant";

function Toggle({ checked, onChange, label, help }: { checked: boolean; onChange: (v: boolean) => void; label: string; help: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{help}</span>
      </span>
      <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[var(--classroom)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function ProgressionPage() {
  const rules = useProgressRules();
  const save = useSaveProgressRules();
  const recompute = useRecomputeProgress();
  const [f, setF] = useState<ProgressRules | null>(null);
  useEffect(() => { if (rules.data && !f) setF(rules.data); }, [rules.data, f]);

  if (rules.isLoading || !f) return <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  const set = <K extends keyof ProgressRules>(k: K, v: ProgressRules[K]) => setF({ ...f, [k]: v });

  async function submit() {
    try {
      await save.mutateAsync(f!);
      toast.success("Règles de progression enregistrées");
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "Échec"); }
  }
  async function runRecompute() {
    if (!confirm("Recalculer la progression de toutes les inscriptions avec ces règles ?")) return;
    try {
      const r = await recompute.mutateAsync();
      toast.success(`${r.enrollments} inscription(s) recalculée(s) · ${r.newlyCompleted} cours nouvellement terminé(s)`);
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "Échec"); }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Progression des cours</h2>
        <p className="text-sm text-muted-foreground">Quand un cours est-il « terminé » ? Quand le quiz et le devoir s'ouvrent-ils ? Que voit l'étudiant ? Les statuts, le nombre de cours terminés et les pourcentages se mettent à jour automatiquement.</p>
      </div>

      <div className={box}>
        <h3 className="font-semibold">Cours terminé</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="block text-xs text-muted-foreground">Leçons à terminer — cours du cursus universitaire</span>
            <span className="mt-1 flex items-center gap-2"><input type="number" min={1} max={100} className="h-10 w-24 rounded-xl border bg-background px-3" value={f.cursusLessonThreshold} onChange={(e) => set("cursusLessonThreshold", Number(e.target.value))} /> %</span>
          </label>
          <label className="text-sm">
            <span className="block text-xs text-muted-foreground">Leçons à terminer — cours certifiants</span>
            <span className="mt-1 flex items-center gap-2"><input type="number" min={1} max={100} className="h-10 w-24 rounded-xl border bg-background px-3" value={f.certifyingLessonThreshold} onChange={(e) => set("certifyingLessonThreshold", Number(e.target.value))} /> %</span>
          </label>
        </div>
        <div className="mt-2 divide-y">
          <Toggle checked={f.requireQuizzes} onChange={(v) => set("requireQuizzes", v)} label="Exiger la réussite des quiz" help="Le cours n'est terminé qu'une fois tous ses quiz réussis." />
          <Toggle checked={f.requireAssignments} onChange={(v) => set("requireAssignments", v)} label="Exiger le rendu des devoirs" help="Le cours n'est terminé qu'une fois tous ses devoirs ouverts rendus." />
        </div>
      </div>

      <div className={box}>
        <h3 className="font-semibold">Quiz et devoirs</h3>
        <div className="divide-y">
          <Toggle checked={f.activitiesAfterLessons} onChange={(v) => set("activitiesAfterLessons", v)} label="Ouvrir le quiz et les devoirs après les leçons" help="Désactivé : accessibles dès le début du cours. Dans tous les cas, l'activité prévue est proposée automatiquement dès la fin des leçons." />
        </div>
      </div>

      <div className={box}>
        <h3 className="font-semibold">Mois et affichage de l'espace étudiant</h3>
        <div className="divide-y">
          <Toggle checked={f.monthGate} onChange={(v) => set("monthGate", v)} label="Mois suivant après les cours du mois précédent (étudiants en ligne)" help="L'étudiant en ligne ne paie le mois N qu'une fois les cours du mois N-1 terminés. Un mois sans cours publié ne bloque jamais." />
          <Toggle checked={f.showLockedCourses} onChange={(v) => set("showLockedCourses", v)} label="Montrer les cours des mois pas encore payés" help="Désactivé : seul le nombre de cours du mois est indiqué jusqu'au paiement." />
          <Toggle checked={f.showCourseProgress} onChange={(v) => set("showCourseProgress", v)} label="Montrer le pourcentage de progression de chaque cours" help="Barre de progression sous chaque cours dans « Mes cours »." />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={submit} disabled={save.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl grad-classroom px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer les règles
        </button>
        <button onClick={runRecompute} disabled={recompute.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-60">
          {recompute.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Recalculer la progression de tous les étudiants
        </button>
      </div>
    </div>
  );
}
