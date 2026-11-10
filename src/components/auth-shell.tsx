// Mise en page des pages de connexion et d'inscription des cours en ligne :
// à gauche la photo de l'université avec le logo, à droite le formulaire.
// Même présentation que la connexion de l'espace université (/classroom).
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { LogoMark, LogoOnPhoto, serif } from "@/components/site-layout";
import { FIELD, FIELD_LABEL } from "@/components/form-fields";

export function AuthShell({ photo, subtitle, backTo, children }: {
  photo: string;
  subtitle: string;
  backTo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative isolate hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <img src={photo} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 grad-online opacity-[0.88]" />
        <Link to={backTo} className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <div className="flex flex-col items-center text-center">
          <LogoOnPhoto />
          <h1 className="mt-8 text-4xl font-semibold tracking-tight" style={serif}>Université Références</h1>
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.3em] text-white/70">{subtitle}</p>
        </div>
        <div className="text-xs opacity-60">© Université Références {new Date().getFullYear()}</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Petits écrans : le panneau de gauche est masqué */}
          <Link to={backTo} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground lg:hidden">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark className="h-11" />
            <div>
              <p className="font-semibold text-foreground" style={serif}>Université Références</p>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export const authInput = FIELD;
export const authLabel = FIELD_LABEL;
export const authButton = "flex w-full items-center justify-center gap-2 rounded-xl grad-online py-3 text-sm font-semibold text-white shadow-elegant transition-opacity disabled:opacity-60";
