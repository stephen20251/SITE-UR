// Champs « cursus universitaire » d'un cours : type (universitaire / certifiant /
// les deux), mention, niveau, mois, volume horaire, cours liés, diplôme délivré.
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Award, Layers } from "lucide-react";
import { api } from "@/lib/api";
import { useMyCourses, type CourseKind } from "@/lib/online";
import { LEVELS, MONTHS, cursusPlace, monthSemesterLabel } from "@/lib/cursus";

export type CursusValue = {
  courseKind: CourseKind;
  credentialType: "CERTIFICATE" | "ATTESTATION";
  mentionId: string | null;
  cursusLevel: string | null;
  cursusMonth: number | null;
  totalHours: number | null;
  relatedCourseIds: string[];
};

export const emptyCursus: CursusValue = {
  courseKind: "CERTIFYING", credentialType: "CERTIFICATE", mentionId: null,
  cursusLevel: null, cursusMonth: null, totalHours: null, relatedCourseIds: [],
};

export function cursusValueOf(c: Partial<CursusValue> & { relatedCourseIds?: string[] }): CursusValue {
  return {
    courseKind: c.courseKind ?? "CERTIFYING",
    credentialType: c.credentialType ?? "CERTIFICATE",
    mentionId: c.mentionId ?? null,
    cursusLevel: c.cursusLevel ?? null,
    cursusMonth: c.cursusMonth ?? null,
    totalHours: c.totalHours ?? null,
    relatedCourseIds: c.relatedCourseIds ?? [],
  };
}

// Charge utile envoyée à l'API (les champs du cursus sont vidés pour un cours certifiant).
export function cursusPayload(v: CursusValue) {
  const inCursus = v.courseKind !== "CERTIFYING";
  return {
    courseKind: v.courseKind,
    credentialType: v.credentialType,
    cursusLevel: inCursus ? v.cursusLevel : null,
    cursusMonth: inCursus ? v.cursusMonth : null,
    totalHours: v.totalHours,
    relatedCourseIds: inCursus ? v.relatedCourseIds : [],
  };
}

export const cursusIncomplete = (v: CursusValue) =>
  v.courseKind !== "CERTIFYING" && (!v.cursusLevel || !v.cursusMonth);

const KINDS = [
  { v: "UNIVERSITY", label: "Cursus universitaire", desc: "Cursus de l'UR · aussi ouvert au public en ligne", Icon: GraduationCap },
  { v: "CERTIFYING", label: "Cours certifiant", desc: "Ouvert à tous · certificat / attestation", Icon: Award },
  { v: "BOTH", label: "Les deux", desc: "Dans le cursus et parmi les cours certifiants", Icon: Layers },
] as const;

const inp = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function CursusFields({
  value, onChange, courseId,
}: { value: CursusValue; onChange: (v: CursusValue) => void; courseId?: string }) {
  const set = <K extends keyof CursusValue>(k: K, v: CursusValue[K]) => onChange({ ...value, [k]: v });
  const inCursus = value.courseKind !== "CERTIFYING";
  const certifying = true;

  const mine = useMyCourses(undefined, { enabled: inCursus });
  const relatedOptions = (mine.data?.items ?? []).filter(
    (c) => c.id !== courseId && c.courseKind && c.courseKind !== "CERTIFYING",
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Type de cours</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {KINDS.map(({ v, label, desc, Icon }) => (
            <button
              key={v}
              type="button"
              onClick={() => set("courseKind", v)}
              className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${value.courseKind === v ? "border-online bg-online/5" : "hover:bg-accent"}`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${value.courseKind === v ? "text-online" : "text-muted-foreground"}`} />
              <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {inCursus && (
        <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
          <p className="text-xs font-medium text-muted-foreground">Place dans le cursus</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">
              Pour les étudiants de
              <select className={`${inp} mt-1`} value={value.cursusLevel ?? ""} onChange={(e) => set("cursusLevel", e.target.value || null)}>
                <option value="">Choisir le niveau…</option>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Mois du cursus
              <select className={`${inp} mt-1`} value={value.cursusMonth ?? ""} onChange={(e) => set("cursusMonth", e.target.value ? Number(e.target.value) : null)}>
                <option value="">Choisir le mois…</option>
                {MONTHS.map((m) => <option key={m} value={m}>Mois {m} ({monthSemesterLabel(value.cursusLevel, m)})</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Volume horaire prévu (h)
              <input type="number" min={1} className={`${inp} mt-1`} value={value.totalHours ?? ""}
                onChange={(e) => set("totalHours", e.target.value ? Number(e.target.value) : null)} placeholder="Ex : 30" />
            </label>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">En rapport avec d'autres cours ? <span className="opacity-70">(à terminer avant celui-ci)</span></p>
            {relatedOptions.length === 0 ? (
              <p className="mt-1 text-xs italic text-muted-foreground">Aucun autre cours du cursus — cours indépendant.</p>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {relatedOptions.map((c) => {
                  const on = value.relatedCourseIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => set("relatedCourseIds", on ? value.relatedCourseIds.filter((x) => x !== c.id) : [...value.relatedCourseIds, c.id])}
                      className={`rounded-full border px-2.5 py-1 text-xs transition ${on ? "border-online bg-online/10 text-online" : "hover:bg-accent"}`}
                    >
                      {c.title}{c.cursusLevel ? ` · ${cursusPlace(c.cursusLevel, c.cursusMonth)}` : ""}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Contenu non téléchargeable et non partageable pour les étudiants. Ajoutez un test « étudiants » pour valider le cours.
          </p>
        </div>
      )}

      {certifying && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Document délivré {inCursus ? "aux non-étudiants" : ""}</p>
          <div className="flex gap-2">
            {([["CERTIFICATE", "Certificat"], ["ATTESTATION", "Attestation"]] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => set("credentialType", v)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${value.credentialType === v ? "border-online bg-online/10 text-online" : "hover:bg-accent"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
