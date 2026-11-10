// Champs de formulaire des pages de connexion et d'inscription : cadre rectangulaire net,
// texte lisible, contour bleu nuit au focus (rouge clair en thème sombre), et champ de
// mot de passe avec un bouton « œil » pour vérifier ce qu'on a tapé.
import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

export const FIELD =
  "h-12 w-full rounded-md border border-slate-300 bg-white px-4 text-[15px] text-slate-900 shadow-sm outline-none transition " +
  "placeholder:text-slate-400 hover:border-slate-400 focus:border-[#14204a] focus:ring-4 focus:ring-[#14204a]/10 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:hover:border-slate-500 " +
  "dark:focus:border-[#f87171] dark:focus:ring-[#f87171]/15";

export const FIELD_LABEL = "mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200";

export function PasswordInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${className ?? FIELD} pr-12`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
        title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-md text-slate-500 transition hover:text-[#14204a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14204a]/30 dark:text-slate-400 dark:hover:text-white"
      >
        {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}
