import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, Building2, CalendarDays, ChevronDown, Clock, ExternalLink, GraduationCap, LogIn, MapPin, Menu,
  MonitorPlay, Navigation, Search, UserPlus, X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { usePublicSettings } from "@/lib/lms-admin";
import { mediaUrl } from "@/components/online/mooc-card";
import { eventImage, type UniversityEvent } from "@/lib/events";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Université Références — Antananarivo" },
      { name: "description", content: "Université Références : formations en amphithéâtre et en ligne, de la Licence au Master, à Antananarivo." },
    ],
    links: [
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap" },
    ],
  }),
  component: Home,
});

// ─── Données publiques ────────────────────────────────────────────────────────
type HomeData = {
  faculties: { id: string; name: string; code: string; mentions: { id: string; name: string; description: string | null }[] }[];
};

const serif = { fontFamily: "'Playfair Display', Georgia, serif" };
// Couleurs du logo : rouge et bleu marine, sur fond sombre.
const RED = "#e3262b";
const RED_SOFT = "#f87171";
const BLUE_SOFT = "#a5b4fc";
const BG = "#0b1120";       // fond principal
const BG_ALT = "#0f172a";   // sections alternées
const CARD = "#162036";     // cartes

// Emplacement de l'université (fiche Google Maps « University Reference »)
const MAP = {
  lat: -18.870093,
  lng: 47.5256541,
  link: "https://maps.app.goo.gl/EaE7E622bSG47S9Q7",
};
const MAP_EMBED = `https://www.google.com/maps?q=${MAP.lat},${MAP.lng}&hl=fr&z=17&output=embed`;
const MAP_ROUTE = `https://www.google.com/maps/dir/?api=1&destination=${MAP.lat},${MAP.lng}`;

const IMG = {
  hero: "/hero-diplomes.png",
  about: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1000&auto=format&fit=crop&q=85",
  campus: [
    { title: "Vie étudiante", img: "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=900&auto=format&fit=crop&q=85" },
    { title: "Art & Culture", img: "https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=900&auto=format&fit=crop&q=85" },
    { title: "Sports & Loisirs", img: "https://images.unsplash.com/photo-1562774053-701939374585?w=900&auto=format&fit=crop&q=85" },
  ],
};
// Visuel par faculté (selon son code), sinon visuel générique.
const FACULTY_IMG: Record<string, string> = {
  "FAC-ST": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=900&auto=format&fit=crop&q=85",
  "FAC-SEG": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=900&auto=format&fit=crop&q=85",
  "FAC-LL": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=900&auto=format&fit=crop&q=85",
};
const FACULTY_FALLBACK = "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=900&auto=format&fit=crop&q=85";
// Ordre d'affichage des formations : Gestion, Informatique, puis Langues (Anglais) ; les autres ensuite.
const FACULTY_ORDER = ["FAC-SEG", "FAC-ST", "FAC-LL"];
const facultyRank = (code: string) => { const i = FACULTY_ORDER.indexOf(code); return i === -1 ? FACULTY_ORDER.length : i; };

const NAV = [
  { href: "#top", label: "Accueil" },
  { href: "#universite", label: "L'Université" },
  { href: "#formations", label: "Formation" },
  { href: "#actualites", label: "Actualité" },
  { href: "#contact", label: "Contact" },
  { href: "#adresse", label: "Adresse" },
];

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "");

// Logo de l'université : celui des paramètres de la plateforme, sinon le fichier du site.
// L'image est carrée avec de larges marges : on l'agrandit sur l'emblème.
function Logo({ size = 48 }: { size?: number }) {
  const { data: settings } = usePublicSettings();
  const src = settings?.logoUrl ? mediaUrl(settings.logoUrl) : "/logo-ur.jpg";
  return (
    <span className="block shrink-0 overflow-hidden rounded-xl bg-[#f5f5f5] shadow-md ring-1 ring-white/20" style={{ width: size, height: size }}>
      <img src={src} alt="Logo de l'Université Références" className="h-full w-full scale-[1.55] object-cover" />
    </span>
  );
}

function Brand() {
  return (
    <a href="#top" className="flex items-center gap-3">
      <Logo />
      <div className="leading-tight">
        <div className="text-lg font-bold text-white" style={serif}>Université</div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: RED_SOFT }}>Références</div>
      </div>
    </a>
  );
}

function Eyebrow({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  return <p className={`text-sm font-bold uppercase tracking-[0.14em] ${center ? "text-center" : ""}`} style={{ color: RED_SOFT }}>{children}</p>;
}

// Carte d'événement : date en pastille, lieu, horaire ; la description se déplie.
function EventCard({ ev }: { ev: UniversityEvent }) {
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

// ─── Page ─────────────────────────────────────────────────────────────────────
function Home() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["public", "home"],
    queryFn: () => api<HomeData>("/online/public/home", { auth: false }),
    staleTime: 60_000,
  });

  // Événements publiés par le Super administrateur / le Secrétariat
  const events = useQuery({
    queryKey: ["events", "public"],
    queryFn: () => api<UniversityEvent[]>("/events/public?limit=6", { auth: false }),
    staleTime: 60_000,
  });
  const faculties = [...(data?.faculties ?? [])].sort((a, b) => facultyRank(a.code) - facultyRank(b.code) || a.name.localeCompare(b.name));

  return (
    <div id="top" className="min-h-screen text-slate-300" style={{ background: BG }}>
      {/* ── EN-TÊTE ─────────────────────────────────────────────────────── */}
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

      {/* ── HÉROS ───────────────────────────────────────────────────────── */}
      <section className="relative isolate flex min-h-[calc(100vh-76px)] items-center overflow-hidden">
        <img src={IMG.hero} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0b1120]/85 via-[#0b1120]/45 to-transparent" />
        <div className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-white">Bienvenue à l'Université Références</p>
          <h1 className="mt-5 text-5xl font-bold leading-[1.05] text-white sm:text-6xl lg:text-7xl" style={serif}>
            Former, Chercher
            <br />
            <span style={{ color: RED_SOFT }}>& Innover </span>
            <span style={{ color: BLUE_SOFT }}>Ensemble</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-200">
            Des formations de la Licence au Master, en amphithéâtre comme en ligne, au service de la réussite de chaque étudiant.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <a href="#formations" className="rounded-md px-8 py-3.5 text-base font-semibold text-white shadow-lg transition hover:brightness-110" style={{ background: RED }}>
              Nos formations
            </a>
            <a href="#adresse" className="rounded-md border-2 border-white/70 px-8 py-3 text-base font-semibold text-white transition hover:bg-white/10">
              Nous trouver
            </a>
          </div>
        </div>
      </section>

      {/* ── L'UNIVERSITÉ ────────────────────────────────────────────────── */}
      <section id="universite" className="scroll-mt-20" style={{ background: BG_ALT }}>
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="relative pb-10">
            <img src={IMG.about} alt="Étudiants de l'Université Références" className="aspect-[6/5] w-full rounded-2xl object-cover shadow-2xl ring-1 ring-white/10" />
            <div className="absolute bottom-0 right-0 max-w-xs rounded-xl p-6 shadow-xl ring-1 ring-white/10 sm:-right-6" style={{ background: CARD }}>
              <p className="text-lg italic leading-snug text-slate-100" style={serif}>
                « Former aujourd'hui les talents qui feront le Madagascar de demain. »
              </p>
            </div>
          </div>
          <div>
            <Eyebrow>À propos de nous</Eyebrow>
            <h2 className="mt-3 text-4xl font-bold leading-tight text-white sm:text-5xl" style={serif}>
              Une université ancrée dans son temps
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-slate-300">
              À Antananarivo, l'Université Références allie l'enseignement en présentiel à une plateforme en ligne
              complète : cours vidéo, tests, suivi de progression et certificats vérifiables.
            </p>
            <ul className="mt-7 space-y-4">
              {[
                "Cursus universitaire de la Licence au Master, semestre après semestre",
                "Cours certifiants ouverts à tous, à suivre à son rythme",
                "Suivi personnalisé : présences, notes, progression et écolage en ligne",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-base font-medium text-slate-100">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: RED }} /> {t}
                </li>
              ))}
            </ul>
            <a href="#formations" className="mt-8 inline-flex items-center gap-2 font-semibold" style={{ color: RED_SOFT }}>
              Découvrir nos formations <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ── FORMATION : FACULTÉS & MENTIONS ─────────────────────────────── */}
      <section id="formations" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <Eyebrow center>Nos formations</Eyebrow>
          <h2 className="mt-3 text-center text-4xl font-bold text-white sm:text-5xl" style={serif}>Mention et Formation</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-slate-400">
            Nos facultés et leurs mentions, de la Licence au Master, en présentiel et en ligne.
          </p>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {faculties.map((f) => (
              <div key={f.id} className="overflow-hidden rounded-2xl ring-1 ring-white/10 transition hover:ring-white/25" style={{ background: CARD }}>
                <div className="relative aspect-[16/10]">
                  <img src={FACULTY_IMG[f.code] ?? FACULTY_FALLBACK} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <div className="text-xs font-bold tracking-wider" style={{ color: RED_SOFT }}>{f.code.replace(/^FAC-/, "")}</div>
                    <h3 className="mt-1 text-xl font-bold leading-snug text-white" style={serif}>{f.name}</h3>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-sm font-semibold text-slate-100">Mentions</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-400">
                    {f.mentions.length === 0 && <li className="italic">Mentions en préparation.</li>}
                    {f.mentions.map((m) => (
                      <li key={m.id} className="flex items-start gap-2">
                        <GraduationCap className="mt-0.5 h-4 w-4 shrink-0" style={{ color: BLUE_SOFT }} />
                        <span><b className="font-semibold text-slate-100">{m.name}</b>{m.description ? ` — ${m.description}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <a href="/classroom?candidater=1" className="inline-flex items-center gap-2 rounded-md px-7 py-3 text-base font-semibold text-white shadow" style={{ background: RED }}>
              <UserPlus className="h-5 w-5" /> Déposer ma candidature
            </a>
            <Link to="/online" className="inline-flex items-center gap-2 rounded-md border border-white/20 px-7 py-3 text-base font-semibold text-white hover:bg-white/5">
              <MonitorPlay className="h-5 w-5" /> Cours en ligne
            </Link>
          </div>
        </div>
      </section>

      {/* ── ACTUALITÉ ───────────────────────────────────────────────────── */}
      <section id="actualites" className="scroll-mt-20" style={{ background: BG_ALT }}>
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <Eyebrow>Actualité</Eyebrow>
          <h2 className="mt-2 text-4xl font-bold text-white" style={serif}>Nos événements</h2>
          {events.isLoading ? null : (events.data ?? []).length === 0 ? (
            <div className="mt-12 rounded-2xl p-10 text-center ring-1 ring-white/10" style={{ background: CARD }}>
              <CalendarDays className="mx-auto h-10 w-10 text-slate-500" />
              <p className="mt-3 text-slate-300">Aucun événement annoncé pour le moment.</p>
              <p className="text-sm text-slate-500">Revenez bientôt : les prochains rendez-vous de l'université seront publiés ici.</p>
            </div>
          ) : (
            <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {events.data!.map((ev) => <EventCard key={ev.id} ev={ev} />)}
            </div>
          )}
        </div>
      </section>

      {/* ── VIE AU CAMPUS ───────────────────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="grid items-end gap-8 lg:grid-cols-2">
            <div>
              <Eyebrow>Vie au campus</Eyebrow>
              <h2 className="mt-3 text-4xl font-bold leading-tight text-white sm:text-5xl" style={serif}>
                Plus qu'un lieu d'étude,<br />un lieu de vie
              </h2>
            </div>
            <p className="text-lg leading-relaxed text-slate-300">
              Associations, activités culturelles et sportives, entraide entre étudiants : à l'Université Références,
              chacun trouve sa place et construit son réseau.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {IMG.campus.map((c, i) => (
              <div key={c.title} className={`group relative overflow-hidden rounded-2xl ring-1 ring-white/10 ${i === 1 ? "md:mt-12" : ""}`}>
                <img src={c.img} alt="" className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                <h3 className="absolute bottom-6 left-6 text-2xl font-bold text-white" style={serif}>{c.title}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT : NOS ESPACES ───────────────────────────────────────── */}
      <section id="contact" className="scroll-mt-20" style={{ background: "linear-gradient(120deg, #1b1a4a 0%, #26246b 50%, #6b1418 100%)" }}>
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-bold uppercase tracking-[0.14em] text-white/80">Contact</p>
          <h2 className="mt-3 text-center text-4xl font-bold text-white" style={serif}>Entrer en relation avec nous</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-200">
            Candidater, suivre sa scolarité ou apprendre en ligne : chaque démarche a son espace.
          </p>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { to: "/classroom?candidater=1", Icon: UserPlus, t: "Candidature", d: "Créez votre dossier, choisissez votre mention : le secrétariat des admissions vous répond.", cta: "Candidater" },
              { to: "/classroom", Icon: Building2, t: "Espace université", d: "Étudiants, enseignants et parents : messagerie, emploi du temps, notes, écolage.", cta: "Se connecter" },
              { to: "/online", Icon: MonitorPlay, t: "UR Online", d: "Cours en ligne : cursus universitaire et cours certifiants, à suivre à votre rythme.", cta: "Explorer les cours" },
            ].map(({ to, Icon, t, d, cta }) => (
              <a key={t} href={to} className="group rounded-2xl p-6 ring-1 ring-white/15 transition hover:ring-white/35" style={{ background: "rgba(11,17,32,0.55)" }}>
                <span className="grid h-12 w-12 place-items-center rounded-xl text-white" style={{ background: RED }}><Icon className="h-6 w-6" /></span>
                <h3 className="mt-4 text-xl font-bold text-white" style={serif}>{t}</h3>
                <p className="mt-2 text-sm text-slate-300">{d}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: RED_SOFT }}>{cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── ADRESSE : CARTE GOOGLE MAPS ─────────────────────────────────── */}
      <section id="adresse" className="scroll-mt-20" style={{ background: BG_ALT }}>
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:px-8">
          <div className="flex flex-col justify-center">
            <Eyebrow>Adresse</Eyebrow>
            <h2 className="mt-3 text-4xl font-bold text-white" style={serif}>Venez nous rencontrer</h2>
            <div className="mt-8 flex gap-4 rounded-xl p-5 ring-1 ring-white/10" style={{ background: CARD }}>
              <MapPin className="h-6 w-6 shrink-0" style={{ color: RED_SOFT }} />
              <div>
                <div className="font-semibold text-white">University Reference</div>
                <div className="text-sm text-slate-400">Antananarivo, Madagascar</div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={MAP_ROUTE} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-semibold text-white" style={{ background: RED }}>
                <Navigation className="h-4 w-4" /> Itinéraire
              </a>
              <a href={MAP.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:bg-white/5">
                <ExternalLink className="h-4 w-4" /> Ouvrir dans Google Maps
              </a>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
            <iframe
              title="Plan d'accès — Université Références"
              src={MAP_EMBED}
              className="h-[420px] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      {/* ── PIED DE PAGE ────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10" style={{ background: "#070b16" }}>
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div>
            <Brand />
            <p className="mt-5 text-sm leading-relaxed text-slate-400">
              « Former, chercher et innover ensemble. » L'Université Références forme les talents de demain, en
              alliant exigence académique et ouverture sur le monde professionnel.
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
            <h3 className="text-lg font-bold text-white" style={serif}>Adresse</h3>
            <ul className="mt-5 space-y-4 text-sm text-slate-400">
              <li className="flex gap-3"><MapPin className="h-5 w-5 shrink-0" /> University Reference, Antananarivo, Madagascar</li>
              <li><a href={MAP.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white"><ExternalLink className="h-4 w-4" /> Voir sur Google Maps</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white" style={serif}>Espace numérique</h3>
            <p className="mt-5 text-sm text-slate-400">Accédez à votre espace selon votre profil.</p>
            <Link to="/choice" className="mt-4 flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold text-white" style={{ background: RED }}>
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
    </div>
  );
}
