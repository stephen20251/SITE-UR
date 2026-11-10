// En-tête, pied de page et éléments communs aux pages publiques du site
// (accueil, Actualités, archives, article).
//
// Deux thèmes : clair (noir et blanc) et sombre (bleu nuit et rouge du logo).
// Les photos restent en couleur dans les deux thèmes. Les classes « dark: »
// s'appliquent sous un conteneur portant la classe « dark » : voir SitePage.
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, Clock, ExternalLink, Facebook, LogIn, Mail, MapPin, Menu, Moon, Phone, Sun, X } from "lucide-react";
import { CONTACT } from "@/lib/contact";
import { useAuth } from "@/lib/auth";
import { usePublicSettings } from "@/lib/lms-admin";
import { mediaUrl } from "@/components/online/mooc-card";
import { eventImage, type UniversityEvent } from "@/lib/events";

export const serif = { fontFamily: "'Playfair Display', Georgia, serif" };
export const SITE_FONTS = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap";

// Classes partagées. Thème sombre : #0b1120 (fond), #0f172a (sections alternées),
// #162036 (cartes), rouge #e3262b, rouge clair #f87171.
export const UI = {
  label: "text-[11px] font-medium uppercase tracking-[0.28em]",
  eyebrow: "text-neutral-500 dark:text-[#f87171]",
  title: "text-black dark:text-white",
  text: "text-neutral-600 dark:text-slate-400",
  muted: "text-neutral-500 dark:text-slate-400",
  photo: "", // photos toujours en couleur (classe gardée pour un éventuel filtre commun)
  altBg: "bg-neutral-50 dark:bg-[#0f172a]",
  card: "bg-white ring-1 ring-neutral-200 dark:bg-[#162036] dark:ring-white/10",
  border: "border-neutral-200 dark:border-white/10",
  accent: "text-black dark:text-[#f87171]",
  btnDark: "inline-flex items-center justify-center gap-2 bg-black px-7 py-3.5 text-sm font-medium tracking-wide text-white transition hover:bg-neutral-800 dark:bg-[#e3262b] dark:hover:bg-[#c81e23]",
  btnLine: "inline-flex items-center justify-center gap-2 border border-black px-7 py-3.5 text-sm font-medium tracking-wide text-black transition hover:bg-black hover:text-white dark:border-white/30 dark:text-white dark:hover:bg-white dark:hover:text-[#0b1120]",
};

// Emplacement de l'université (fiche Google Maps « University Reference »)
export const MAP = {
  lat: -18.870093,
  lng: 47.5256541,
  link: "https://maps.app.goo.gl/EaE7E622bSG47S9Q7",
};

// Page Facebook officielle (remplacée par celle des paramètres de la plateforme si elle est renseignée)
export const FACEBOOK_URL = "https://www.facebook.com/university.reference/";
export function useFacebookUrl() {
  const { data: settings } = usePublicSettings();
  return settings?.socialFacebook?.trim() || FACEBOOK_URL;
}

// Thème choisi par le visiteur, gardé dans son navigateur.
// Un changement dans un composant (bouton du menu) prévient les autres (mise en page).
const THEME_KEY = "ur-site-theme";
const THEME_EVENT = "ur-site-theme";

// Pages publiques qui suivent le thème choisi (les espaces de gestion restent clairs).
export const isThemedPath = (p: string) =>
  p === "/" || p === "/choice" || p.startsWith("/actualites") || p.startsWith("/online");

// Script exécuté dans <head> avant l'affichage : évite que la page apparaisse
// d'abord en clair puis bascule en sombre.
export const THEME_BOOT_SCRIPT = `(function(){try{var p=location.pathname;var t=(p==="/"||p==="/choice"||p.indexOf("/actualites")===0||p.indexOf("/online")===0)&&localStorage.getItem("${THEME_KEY}")==="dark";if(t)document.documentElement.classList.add("dark")}catch(e){}})();`;
export function useSiteTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => { try { setDark(localStorage.getItem(THEME_KEY) === "dark"); } catch { /* stockage indisponible */ } };
    read();
    window.addEventListener(THEME_EVENT, read);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener(THEME_EVENT, read); window.removeEventListener("storage", read); };
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    try { localStorage.setItem(THEME_KEY, next ? "dark" : "light"); } catch { /* stockage indisponible */ }
    window.dispatchEvent(new Event(THEME_EVENT));
  };
  return { dark, toggle };
}

// Emblème en couleurs sans fond, éclairé d'un halo blanc pour rester lisible sur une
// photo ou un fond coloré (pages de connexion).
export function LogoOnPhoto({ className = "h-36" }: { className?: string }) {
  return (
    <img src="/logo-ur-embleme.png" alt="Logo de l'Université Références"
      className={`${className} w-auto [filter:drop-shadow(0_0_1px_rgba(255,255,255,0.9))_drop-shadow(0_0_18px_rgba(255,255,255,0.55))]`} />
  );
}

export const NAV = [
  { href: "/#universite", label: "L'Université" },
  { href: "/#formations", label: "Formations" },
  { href: "/#admissions", label: "Admissions" },
  { href: "/actualites", label: "Actualités" },
  { href: "/#adresse", label: "Contact" },
];

export const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "");

// Logo de l'université : celui des paramètres de la plateforme, sinon le fichier du site.
// L'image est carrée avec de larges marges : on l'agrandit sur l'emblème.
export function Logo({ size = 48 }: { size?: number }) {
  const { data: settings } = usePublicSettings();
  const src = settings?.logoUrl ? mediaUrl(settings.logoUrl) : "/logo-ur.jpg";
  return (
    <span className="block shrink-0 overflow-hidden rounded-xl bg-[#f5f5f5] shadow-md ring-1 ring-white/20" style={{ width: size, height: size }}>
      <img src={src} alt="Logo de l'Université Références" className="h-full w-full scale-[1.55] object-cover" />
    </span>
  );
}

// Emblème sans fond, pour les menus et pieds de page :
// - tone "auto" : en couleurs sur fond clair, en blanc dans le thème sombre ;
// - tone "white" : toujours blanc (fonds foncés).
// Le logo déposé par l'administration (paramètres de la plateforme) reste prioritaire.
// La version carrée avec fond (Logo) sert sur les photos et les fonds colorés.
export function LogoMark({ className = "h-10", tone = "auto" }: { className?: string; tone?: "auto" | "white" }) {
  const { data: settings } = usePublicSettings();
  const alt = "Logo de l'Université Références";
  if (settings?.logoUrl) return <img src={mediaUrl(settings.logoUrl)} alt={alt} className={`${className} w-auto object-contain`} />;
  if (tone === "white") return <img src="/logo-ur-embleme-blanc.png" alt={alt} className={`${className} w-auto`} />;
  return (
    <>
      <img src="/logo-ur-embleme.png" alt={alt} className={`${className} w-auto dark:hidden`} />
      <img src="/logo-ur-embleme-blanc.png" alt="" aria-hidden className={`${className} hidden w-auto dark:block`} />
    </>
  );
}

function Brand({ mono = false }: { mono?: boolean }) {
  return (
    <a href="/#top" className="flex items-center gap-3">
      <LogoMark tone="white" className="h-12" />
      <div className="leading-tight">
        <div className="text-lg font-bold text-white" style={serif}>Université</div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: mono ? "#a3a3a3" : "#f87171" }}>Références</div>
      </div>
    </a>
  );
}

export function Eyebrow({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  return <p className={`${UI.label} ${UI.eyebrow} ${center ? "text-center" : ""}`}>{children}</p>;
}

// ─── Menu du haut : sobre, avec le choix du thème ────────────────────────────
export function SiteHeader({ dark, onToggleTheme, current }: { dark: boolean; onToggleTheme: () => void; current?: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { label } = UI;
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 backdrop-blur-md dark:border-white/10 dark:bg-[#0b1120]/90">
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <a href="/#top" className="flex items-center gap-3" aria-label="Université Références — accueil">
          <LogoMark className="h-11" />
          <span className="leading-none">
            <span className={`block whitespace-nowrap text-[15px] font-semibold tracking-tight sm:text-[17px] ${UI.title}`} style={serif}>Université Références</span>
            <span className={`mt-1 block ${UI.eyebrow} ${label} !text-[9px]`}>Antananarivo</span>
          </span>
        </a>
        <nav className="ml-auto hidden items-center gap-8 lg:flex">
          {NAV.map((n) => {
            const active = current === n.href;
            return (
              <a key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                className={`group relative py-2 transition ${active ? UI.title : "text-neutral-600 hover:text-black dark:text-slate-300 dark:hover:text-white"} ${label}`}>
                {n.label}
                <span className={`absolute inset-x-0 -bottom-0.5 h-px origin-left bg-black transition-transform duration-300 group-hover:scale-x-100 dark:bg-[#e3262b] ${active ? "scale-x-100" : "scale-x-0"}`} />
              </a>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-2">
          <button
            onClick={onToggleTheme}
            className="grid h-10 w-10 place-items-center text-black transition hover:bg-neutral-100 dark:text-slate-200 dark:hover:bg-white/10"
            aria-label={dark ? "Passer au thème clair" : "Passer au thème sombre"}
            title={dark ? "Thème clair" : "Thème sombre"}
          >
            {dark ? <Sun className="h-[18px] w-[18px]" strokeWidth={1.5} /> : <Moon className="h-[18px] w-[18px]" strokeWidth={1.5} />}
          </button>
          <Link to="/choice" className={`hidden items-center bg-black px-5 py-2.5 text-white transition hover:bg-neutral-800 dark:bg-[#e3262b] dark:hover:bg-[#c81e23] sm:inline-flex ${label} !tracking-[0.2em]`}>
            {user ? "Mon espace" : "Espace numérique"}
          </Link>
          <button onClick={() => setOpen((v) => !v)} className="grid h-10 w-10 place-items-center text-black dark:text-white lg:hidden" aria-label="Menu" aria-expanded={open}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-neutral-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-[#0b1120] lg:hidden">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setOpen(false)} className={`block border-b border-neutral-100 py-3.5 text-neutral-700 dark:border-white/5 dark:text-slate-200 ${label}`}>{n.label}</a>
          ))}
          <Link to="/choice" className={`mt-4 flex w-full ${UI.btnDark}`}>{user ? "Mon espace" : "Espace numérique"}</Link>
        </nav>
      )}
    </header>
  );
}

// Page publique complète : thème, menu du haut, contenu, pied de page.
export function SitePage({ current, children }: { current?: string; children: React.ReactNode }) {
  const { dark, toggle } = useSiteTheme();
  return (
    <div className={dark ? "dark" : ""}>
      <div id="top" className="min-h-screen bg-white text-neutral-900 antialiased dark:bg-[#0b1120] dark:text-slate-200">
        <SiteHeader dark={dark} onToggleTheme={toggle} current={current} />
        {children}
        {/* Pied de page : noir en thème clair, bleu nuit et rouge en thème sombre */}
        <SiteFooter mono={!dark} />
      </div>
    </div>
  );
}

// mono : version noir et blanc
export function SiteFooter({ mono = false }: { mono?: boolean }) {
  const facebook = useFacebookUrl();
  return (
    <footer className="border-t border-white/10" style={{ background: mono ? "#000000" : "#070b16" }}>
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <Brand mono={mono} />
          <p className="mt-5 text-sm leading-relaxed text-slate-400">
            L'Université Références (University Reference) forme en Gestion, en Informatique et en Anglais, en présentiel et en ligne,
            à Antananarivo.
          </p>
        </div>
        <div>
          <h3 className="text-lg font-bold text-white" style={serif}>Liens rapides</h3>
          <ul className="mt-5 space-y-3 text-sm text-slate-400">
            {NAV.map((n) => <li key={n.href}><a href={n.href} className="hover:text-white">{n.label}</a></li>)}
            <li><a href="/guide" className="hover:text-white">Guide d'utilisation</a></li>
          </ul>
        </div>
        <div>
          <h3 className="text-lg font-bold text-white" style={serif}>Contact</h3>
          <ul className="mt-5 space-y-4 text-sm text-slate-400">
            <li className="flex gap-3"><MapPin className="h-5 w-5 shrink-0" /> <span>{CONTACT.address}<br />{CONTACT.city}</span></li>
            <li><a href={CONTACT.phoneHref} className="inline-flex items-center gap-3 hover:text-white"><Phone className="h-5 w-5 shrink-0" /> {CONTACT.phone}</a></li>
            <li><a href={`mailto:${CONTACT.email}`} className="inline-flex items-center gap-3 break-all hover:text-white"><Mail className="h-5 w-5 shrink-0" /> {CONTACT.email}</a></li>
            <li><a href={MAP.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white"><ExternalLink className="h-4 w-4" /> Voir sur Google Maps</a></li>
            <li><a href={facebook} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white"><Facebook className="h-4 w-4" /> Suivez-nous sur Facebook</a></li>
          </ul>
        </div>
        <div>
          <h3 className="text-lg font-bold text-white" style={serif}>Espace numérique</h3>
          <p className="mt-5 text-sm text-slate-400">Accédez à votre espace selon votre profil.</p>
          <Link to="/choice" className={`mt-4 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold ${mono ? "bg-white text-black hover:bg-neutral-200" : "text-white"}`} style={mono ? undefined : { background: "#e3262b" }}>
            <LogIn className="h-4 w-4" /> Se connecter
          </Link>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} Université Références. Tous droits réservés.</span>
          <span>Antananarivo · Madagascar</span>
        </div>
      </div>
    </footer>
  );
}

// Carte d'événement : date en pastille, lieu, horaire ; la description se déplie.
export function EventCard({ ev }: { ev: UniversityEvent }) {
  const [open, setOpen] = useState(false);
  const start = new Date(ev.startAt);
  const end = ev.endAt ? new Date(ev.endAt) : null;
  const past = (end ?? start).getTime() < Date.now();
  const img = eventImage(ev.imageUrl);
  const time = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const sameDay = end && end.toDateString() === start.toDateString();
  const when = !end ? `${fmtDate(ev.startAt)} · ${time(start)}`
    : sameDay ? `${fmtDate(ev.startAt)} · ${time(start)} – ${time(end)}`
    : `Du ${fmtDate(ev.startAt)} au ${fmtDate(ev.endAt)}`;
  const long = (ev.description?.length ?? 0) > 140;
  return (
    <article className={`flex flex-col overflow-hidden transition ${UI.card}`}>
      <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100 dark:bg-[#0f172a]">
        {img && <img src={img} alt="" className={`h-full w-full object-cover ${UI.photo}`} />}
        <div className="absolute left-0 top-0 bg-white px-4 py-3 text-center">
          <div className="text-2xl font-semibold leading-none text-black dark:text-[#e3262b]" style={serif}>{start.getDate()}</div>
          <div className={`mt-1 text-neutral-500 ${UI.label} !text-[9px]`}>{start.toLocaleDateString("fr-FR", { month: "short" })}</div>
        </div>
        <span className={`absolute right-3 top-3 px-2 py-1 ${UI.label} !text-[9px] ${past ? "bg-black/70 text-white" : "bg-black text-white dark:bg-[#e3262b]"}`}>
          {past ? "Passé" : "À venir"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className={`text-xl font-semibold leading-snug ${UI.title}`} style={serif}>{ev.title}</h3>
        <p className={`mt-3 flex items-start gap-2 text-sm ${UI.muted}`}><Clock className="mt-0.5 h-4 w-4 shrink-0" /> {when}</p>
        {ev.location && <p className={`mt-1.5 flex items-start gap-2 text-sm ${UI.muted}`}><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {ev.location}</p>}
        {ev.description && (
          <p className={`mt-4 whitespace-pre-line text-sm leading-relaxed ${UI.text} ${open ? "" : "line-clamp-3"}`}>{ev.description}</p>
        )}
        {long && (
          <button onClick={() => setOpen((v) => !v)} className={`mt-auto inline-flex items-center gap-1 self-start pt-4 text-sm font-medium ${UI.accent}`}>
            {open ? "Réduire" : "Lire la suite"} <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
    </article>
  );
}
