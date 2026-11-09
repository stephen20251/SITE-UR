// Carte de cours façon MOOC (Coursera) : établissement, titre, compétences,
// note, niveau, durée et document délivré.
import { Link } from "@tanstack/react-router";
import { Heart, Lock, Star } from "lucide-react";
import type { CourseCard } from "@/lib/online";
import { cursusPlace } from "@/lib/cursus";
import { API_ORIGIN } from "@/lib/env";

const API_BASE = API_ORIGIN;
export function mediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

export const DIFFICULTY: Record<string, string> = {
  BEGINNER: "Débutant", INTERMEDIATE: "Intermédiaire", ADVANCED: "Avancé",
};

// Document obtenu à la fin du cours.
export function credentialOf(c: Pick<CourseCard, "courseKind" | "credentialType">) {
  const doc = c.credentialType === "ATTESTATION" ? "Attestation" : "Certificat";
  if (c.courseKind === "UNIVERSITY") return "Compte pour le diplôme UR";
  return c.courseKind === "BOTH" ? `${doc} · compte pour le diplôme UR` : doc;
}

export function formatLabel(c: Pick<CourseCard, "courseKind" | "cursusLevel" | "cursusMonth">) {
  if (c.courseKind === "UNIVERSITY" || c.courseKind === "BOTH") return `Cursus ${cursusPlace(c.cursusLevel, c.cursusMonth)}`;
  return "Cours certifiant";
}

export function durationLabel(c: Pick<CourseCard, "estimatedHours" | "totalHours">) {
  const h = c.estimatedHours ?? c.totalHours;
  return h ? `${h} h` : null;
}

// Visuel par défaut d'un cours sans image : couleur stable propre au cours + titre.
const COVERS: [string, string][] = [
  ["#4f46e5", "#8b5cf6"], ["#0284c7", "#06b6d4"], ["#059669", "#14b8a6"], ["#e11d48", "#f97316"],
  ["#d97706", "#eab308"], ["#c026d3", "#ec4899"], ["#1d4ed8", "#6366f1"], ["#334155", "#64748b"],
];
export function coverStyle(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const [a, b] = COVERS[h % COVERS.length];
  return { backgroundImage: `linear-gradient(135deg, ${a}, ${b})` };
}
export function CourseCover({ id, title, thumbnail, className = "" }: { id: string; title: string; thumbnail?: string | null; className?: string }) {
  if (thumbnail) return <img src={mediaUrl(thumbnail)} alt="" className={`h-full w-full object-cover ${className}`} />;
  return (
    <div className={`flex h-full w-full flex-col justify-between p-4 text-white ${className}`} style={coverStyle(id)}>
      <span className="self-end rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">UR</span>
      <span className="line-clamp-2 text-lg font-bold leading-tight drop-shadow-sm">{title}</span>
    </div>
  );
}

export function UrMark({ size = 20 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded bg-online font-black text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      UR
    </span>
  );
}

// Accès au cours pour la personne connectée (cursus universitaire).
// tag = étiquette en haut à gauche : ACCESSIBLE / LOCKED (étudiant, cursus),
// CURSUS (non-étudiant, cursus). Sans tag : prix ou « Gratuit » (cours certifiant).
export type CardStatus = {
  label: string; locked?: boolean; done?: boolean; progress?: number;
  tag?: "ACCESSIBLE" | "LOCKED" | "CURSUS";
};
const TAGS = {
  ACCESSIBLE: { text: "Accessible", cls: "bg-emerald-500 text-white" },
  LOCKED: { text: "Non accessible", cls: "bg-slate-800 text-white" },
  CURSUS: { text: "Cursus UR", cls: "bg-white text-online" },
} as const;

export function MoocCard({ c, inWishlist, onToggleWishlist, status }: {
  c: CourseCard;
  inWishlist?: boolean;
  onToggleWishlist?: () => void;
  status?: CardStatus;
}) {
  const free = !c.price;
  // Un cours purement universitaire n'est pas vendu : il relève de l'écolage.
  const tag = status?.tag ? TAGS[status.tag]
    : c.courseKind === "UNIVERSITY" ? TAGS.CURSUS
    : { text: free ? "Gratuit" : `${(c.price ?? 0).toLocaleString("fr-FR")} MGA`, cls: free ? "bg-white text-emerald-700" : "bg-white text-foreground" };
  const meta = [c.level ? DIFFICULTY[c.level] : null, formatLabel(c), durationLabel(c)].filter(Boolean).join(" · ");
  const skills = (c.skills?.length ? c.skills : c.tags ?? []).slice(0, 3);

  return (
    <Link
      to="/online/course/$id"
      params={{ id: c.id }}
      className="group flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        <CourseCover id={c.id} title={c.title} thumbnail={c.thumbnail} className="transition-transform duration-300 group-hover:scale-[1.03]" />
        <span className={`absolute left-2.5 top-2.5 z-10 rounded-md px-2 py-0.5 text-[11px] font-semibold shadow-sm ${tag.cls}`}>
          {tag.text}
        </span>
        {status?.locked && (
          <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-1.5 bg-slate-900/60 text-white">
            <Lock className="h-6 w-6" />
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">{status.label}</span>
          </div>
        )}
        {status?.progress != null && status.progress > 0 && !status.done && (
          <div className="absolute inset-x-0 bottom-0 z-10 h-1 bg-white/40"><div className="h-full bg-white" style={{ width: `${Math.round(status.progress)}%` }} /></div>
        )}
        {onToggleWishlist && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleWishlist(); }}
            title={inWishlist ? "Retirer des favoris" : "Ajouter aux favoris"}
            className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow-sm transition hover:bg-white"
          >
            <Heart className={`h-4 w-4 ${inWishlist ? "fill-rose-500 text-rose-500" : "text-slate-600"}`} />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <UrMark size={18} />
          <span className="truncate">Université Références</span>
        </div>
        <h3 className="mt-2 line-clamp-2 font-semibold leading-snug group-hover:underline">{c.title}</h3>
        <p className="mt-1 truncate text-xs text-muted-foreground">{c.teacher.firstName} {c.teacher.lastName}</p>
        {skills.length > 0 && (
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Compétences acquises : </span>{skills.join(", ")}
          </p>
        )}
        <div className="mt-auto pt-3">
          {(c.ratingCount ?? 0) > 0 && (
            <div className="mb-1 flex items-center gap-1 text-xs">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="font-semibold">{(c.ratingAvg ?? 0).toFixed(1)}</span>
              <span className="text-muted-foreground">({c.ratingCount} avis)</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{meta}</p>
          <p className="mt-1 text-[11px] font-medium text-online">{credentialOf(c)}</p>
          {status && !status.locked && status.label !== "Accessible" && (
            <span className={`mt-2 inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${status.done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-online/10 text-online"}`}>
              {status.label}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function MoocCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="aspect-[16/9] animate-pulse bg-muted" />
      <div className="space-y-2.5 p-4">
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
