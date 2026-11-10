// En-tête, pied de page et éléments communs aux pages publiques du site
// (accueil et Actualités).
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, Clock, ExternalLink, Facebook, LogIn, Mail, MapPin, Menu, Phone, Search, X } from "lucide-react";
import { CONTACT } from "@/lib/contact";
import { useAuth } from "@/lib/auth";
import { usePublicSettings } from "@/lib/lms-admin";
import { mediaUrl } from "@/components/online/mooc-card";
import { eventImage, type UniversityEvent } from "@/lib/events";

export const serif = { fontFamily: "'Playfair Display', Georgia, serif" };
// Couleurs du logo : rouge et bleu marine, sur fond sombre.
export const RED = "#e3262b";
export const RED_SOFT = "#f87171";
export const BLUE_SOFT = "#a5b4fc";
export const BG = "#0b1120";       // fond principal
export const BG_ALT = "#0f172a";   // sections alternées
export const CARD = "#162036";     // cartes

export const SITE_FONTS = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap";

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

// Thème des pages publiques : clair (noir et blanc) ou sombre (bleu nuit et rouge).
// Le choix est gardé dans le navigateur du visiteur.
const THEME_KEY = "ur-site-theme";
export function useSiteTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    try { setDark(localStorage.getItem(THEME_KEY) === "dark"); } catch { /* stockage indisponible */ }
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    try { localStorage.setItem(THEME_KEY, next ? "dark" : "light"); } catch { /* stockage indisponible */ }
  };
  return { dark, toggle };
}

export const NAV = [
  { href: "/#top", label: "Accueil" },
  { href: "/#universite", label: "L'Université" },
  { href: "/#formations", label: "Formation" },
  { href: "/actualites", label: "Actualités" },
  { href: "/#contact", label: "Contact" },
  { href: "/#adresse", label: "Adresse" },
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

function Brand({ mono = false }: { mono?: boolean }) {
  return (
    <a href="/#top" className="flex items-center gap-3">
      <Logo />
      <div className="leading-tight">
        <div className="text-lg font-bold text-white" style={serif}>Université</div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: mono ? "#a3a3a3" : RED_SOFT }}>Références</div>
      </div>
    </a>
  );
}

export function Eyebrow({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  return <p className={`text-sm font-bold uppercase tracking-[0.14em] ${center ? "text-center" : ""}`} style={{ color: RED_SOFT }}>{children}</p>;
}

export function SiteHeader() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 backdrop-blur" style={{ background: "rgba(11,17,32,0.92)" }}>
      <div className="mx-auto flex h-[76px] max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Brand />
        <nav className="ml-auto hidden items-center gap-1.5 lg:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-3">
          <Link to="/online" title="Rechercher un cours" className="grid h-10 w-10 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white">
            <Search className="h-5 w-5" />
          </Link>
          <Link to="/choice" className="hidden items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow sm:inline-flex" style={{ background: RED }}>
            <LogIn className="h-4 w-4" /> {user ? "Mon espace" : "Espace numérique"}
          </Link>
          <button onClick={() => setMenuOpen((v) => !v)} className="grid h-10 w-10 place-items-center rounded-lg text-slate-200 hover:bg-white/10 lg:hidden" aria-label="Menu">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="border-t border-white/10 px-4 py-3 lg:hidden" style={{ background: BG }}>
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5">{n.label}</a>
          ))}
          <Link to="/choice" className="mt-2 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white" style={{ background: RED }}>
            <LogIn className="h-4 w-4" /> {user ? "Mon espace" : "Espace numérique"}
          </Link>
        </nav>
      )}
    </header>
  );
}

// mono : version noir et blanc de la page d'accueil
export function SiteFooter({ mono = false }: { mono?: boolean }) {
  const facebook = useFacebookUrl();
  return (
    <footer className="border-t border-white/10" style={{ background: mono ? "#000000" : "#070b16" }}>
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <Brand mono={mono} />
          <p className="mt-5 text-sm leading-relaxed text-slate-400">
            L'Université Références forme en Gestion, en Informatique et en Anglais, en présentiel et en ligne,
            à Antananarivo.
          </p>
        </div>
        <div>
          <h3 className="text-lg font-bold text-white" style={serif}>Liens rapides</h3>
          <ul className="mt-5 space-y-3 text-sm text-slate-400">
            {NAV.slice(1).map((n) => <li key={n.href}><a href={n.href} className="hover:text-white">{n.label}</a></li>)}
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
          <Link to="/choice" className={`mt-4 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold ${mono ? "bg-white text-black hover:bg-neutral-200" : "rounded-md text-white"}`} style={mono ? undefined : { background: RED }}>
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
    <article className="flex flex-col overflow-hidden rounded-2xl ring-1 ring-white/10 transition hover:ring-white/25" style={{ background: CARD }}>
      <div className="relative aspect-[16/10] overflow-hidden">
        {img
          ? <img src={img} alt="" className="h-full w-full object-cover" />
          : <div className="h-full w-full" style={{ background: "linear-gradient(135deg, #1b1a4a 0%, #26246b 55%, #6b1418 100%)" }} />}
        <div className="absolute left-4 top-4 rounded-xl bg-white px-3 py-2 text-center shadow-lg">
          <div className="text-2xl font-bold leading-none" style={{ color: RED }}>{start.getDate()}</div>
          <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">{start.toLocaleDateString("fr-FR", { month: "short" })}</div>
        </div>
        <span className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${past ? "bg-slate-800/80 text-slate-300" : "text-white"}`} style={past ? undefined : { background: RED }}>
          {past ? "Passé" : "À venir"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-xl font-bold leading-snug text-white" style={serif}>{ev.title}</h3>
        <p className="mt-3 flex items-start gap-2 text-sm text-slate-400"><Clock className="mt-0.5 h-4 w-4 shrink-0" /> {when}</p>
        {ev.location && <p className="mt-1.5 flex items-start gap-2 text-sm text-slate-400"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {ev.location}</p>}
        {ev.description && (
          <p className={`mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-300 ${open ? "" : "line-clamp-3"}`}>{ev.description}</p>
        )}
        {long && (
          <button onClick={() => setOpen((v) => !v)} className="mt-auto inline-flex items-center gap-1 self-start pt-4 text-sm font-medium" style={{ color: RED_SOFT }}>
            {open ? "Réduire" : "Lire la suite"} <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
    </article>
  );
}
