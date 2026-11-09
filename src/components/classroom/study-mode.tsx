// Mode d'étude d'un étudiant : présentiel ou en ligne.
import { Building2, MonitorPlay } from "lucide-react";

export type StudyMode = "PRESENTIEL" | "EN_LIGNE";

export const STUDY_MODES: { value: StudyMode; label: string; hint: string; Icon: typeof Building2 }[] = [
  { value: "PRESENTIEL", label: "Présentiel", hint: "Cours en salle, documents et tests en ligne, sans les vidéos.", Icon: Building2 },
  { value: "EN_LIGNE", label: "En ligne", hint: "Vidéos, documents, devoirs, tests, enregistrements et suivi de progression.", Icon: MonitorPlay },
];
export const studyModeLabel = (m?: string | null) => STUDY_MODES.find((x) => x.value === m)?.label ?? "—";

export function StudyModeBadge({ mode }: { mode?: string | null }) {
  const online = mode === "EN_LIGNE";
  const Icon = online ? MonitorPlay : Building2;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${online ? "border-sky-200 bg-sky-50 text-sky-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
      <Icon size={11} /> {studyModeLabel(mode)}
    </span>
  );
}

export function StudyModePicker({ value, onChange }: { value: StudyMode; onChange: (m: StudyMode) => void }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">Mode d'étude <span className="text-red-500">*</span></p>
      <div className="grid gap-2 sm:grid-cols-2">
        {STUDY_MODES.map(({ value: v, label, hint, Icon }) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={value === v}
            className={`rounded-xl border p-3 text-left transition ${value === v ? "border-classroom bg-classroom/5 ring-2 ring-classroom/20" : "hover:bg-accent"}`}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold"><Icon size={14} /> {label}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
