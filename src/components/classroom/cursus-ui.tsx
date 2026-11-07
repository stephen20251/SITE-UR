// Petits composants partagés par les pages du cursus universitaire.
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { COURSE_STATUS, TUITION_STATUS, type CourseProgress } from "@/lib/cursus";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border bg-card p-5 shadow-elegant ${className}`}>{children}</div>;
}

export function Bar({ value, className = "" }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-muted ${className}`}>
      <div className={`h-full ${v >= 100 ? "bg-emerald-500" : "grad-classroom"}`} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>{children}</span>;
}

export const TuitionBadge = ({ status }: { status: string }) => {
  const s = TUITION_STATUS[status] ?? TUITION_STATUS.UNPAID;
  return <Pill className={s.cls}>{s.label}</Pill>;
};

export const CourseStatusBadge = ({ status }: { status: CourseProgress["status"] }) => {
  const s = COURSE_STATUS[status];
  return <Pill className={s.cls}>{s.label}</Pill>;
};

// Volume horaire + syllabus d'un cours (effectué / restant).
export function HoursSummary({ p }: { p: CourseProgress }) {
  const pct = p.plannedHours > 0 ? Math.round((p.hoursDone / p.plannedHours) * 100) : 0;
  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex justify-between text-muted-foreground">
        <span>Volume horaire : <b className="text-foreground">{p.hoursDone} h</b> effectuées / {p.plannedHours} h</span>
        <span>{p.hoursRemaining} h restantes</span>
      </div>
      <Bar value={pct} />
      <div className="flex justify-between text-muted-foreground">
        <span>Syllabus : {p.syllabusDone}/{p.syllabusTotal} points traités</span>
        <span>{p.syllabusPct} %</span>
      </div>
      <Bar value={p.syllabusPct} />
    </div>
  );
}

export function Loading() {
  return <div className="grid min-h-[40vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>;
}

export function Tabs<T extends string>({ value, onChange, items }: {
  value: T; onChange: (v: T) => void; items: { v: T; label: string; count?: number }[];
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border bg-card p-1">
      {items.map((it) => (
        <button
          key={it.v}
          onClick={() => onChange(it.v)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${value === it.v ? "grad-classroom text-white shadow-sm" : "text-muted-foreground hover:bg-accent"}`}
        >
          {it.label}{it.count != null && <span className="ml-1.5 opacity-80">({it.count})</span>}
        </button>
      ))}
    </div>
  );
}

export const inputCls = "h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
export const btnPrimary = "inline-flex items-center gap-2 rounded-lg grad-classroom px-4 py-2 text-sm font-medium text-white disabled:opacity-50";
export const btnGhost = "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50";

export const todayStr = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
