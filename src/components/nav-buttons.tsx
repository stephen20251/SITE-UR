// Boutons de navigation présents dans tous les en-têtes :
//  • « Retour »  : page précédente (à défaut, `home` = page d'accueil de l'espace)
//  • `homeLabel` : lien optionnel vers la page de l'espace (ex. « Catalogue », « Mon Studio »)
//  • « Accueil » : page d'accueil du site (/)
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Home, LayoutGrid } from "lucide-react";

export function BackHomeButtons({ home, homeLabel, compact = false, className = "" }: {
  home: string;
  homeLabel?: string;
  compact?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const btn = "inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground";
  return (
    <div className={`flex shrink-0 items-center gap-1.5 ${className}`}>
      <button
        type="button"
        title="Retour à la page précédente"
        onClick={() => (window.history.length > 1 ? window.history.back() : navigate({ to: home }))}
        className={btn}
      >
        <ArrowLeft className="h-3.5 w-3.5" />{!compact && "Retour"}
      </button>
      {homeLabel && (
        <Link to={home as "/"} title={homeLabel} className={btn}>
          <LayoutGrid className="h-3.5 w-3.5" />{!compact && homeLabel}
        </Link>
      )}
      <Link to="/" title="Accueil du site" className={btn}>
        <Home className="h-3.5 w-3.5" />{!compact && "Accueil"}
      </Link>
    </div>
  );
}
