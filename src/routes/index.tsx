import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Building2, Facebook, Mail, MapPin, Menu, MonitorPlay, Moon, Navigation, Phone, Sun, UserPlus, X } from "lucide-react";
import { CONTACT } from "@/lib/contact";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { eventImage, type UniversityEvent } from "@/lib/events";
import { Logo, MAP, NAV, SITE_FONTS, SiteFooter, fmtDate, serif, useFacebookUrl, useSiteTheme } from "@/components/site-layout";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Université Références — Antananarivo" },
      { name: "description", content: "Université Références, à Antananarivo : formations en Gestion, en Informatique et en Anglais, en présentiel et en ligne." },
    ],
    links: [{ rel: "stylesheet", href: SITE_FONTS }],
  }),
  component: Home,
});

// Page d'accueil en deux thèmes : clair (noir et blanc, photos en niveaux de gris)
// et sombre (bleu nuit et rouge du logo, photos en couleur). Les classes « dark: »
// s'appliquent quand le conteneur de la page porte la classe « dark ».

type HomeData = {
  faculties: { id: string; name: string; code: string; mentions: { id: string; name: string; description: string | null }[] }[];
};

const MAP_EMBED = `https://www.google.com/maps?q=${MAP.lat},${MAP.lng}&hl=fr&z=17&output=embed`;
const MAP_ROUTE = `https://www.google.com/maps/dir/?api=1&destination=${MAP.lat},${MAP.lng}`;

// Photos de l'université (originaux dans image-UR/, réduites pour le web dans public/images/accueil/)
const PHOTO = "/images/accueil";
const IMG = {
  hero: `${PHOTO}/banniere.jpg`,
  about: `${PHOTO}/universite.jpg`,
  campus: [
    { title: "Vie étudiante", img: `${PHOTO}/campus-vie-etudiante.jpg` },
    { title: "Travaux pratiques", img: `${PHOTO}/campus-travaux-pratiques.jpg` },
    { title: "Esprit d'équipe", img: `${PHOTO}/campus-esprit-equipe.jpg` },
  ],
};
// Photo par faculté (selon son code), sinon la photo générale de l'université.
const FACULTY_IMG: Record<string, string> = {
  "FAC-SEG": `${PHOTO}/mention-gestion.jpg`,
  "FAC-ST": `${PHOTO}/mention-informatique.jpg`,
  "FAC-LL": `${PHOTO}/mention-anglais.jpg`,
};
const FACULTY_FALLBACK = IMG.about;
// Ordre d'affichage : Gestion, Informatique, puis Langues (Anglais) ; les autres ensuite.
const FACULTY_ORDER = ["FAC-SEG", "FAC-ST", "FAC-LL"];
const facultyRank = (code: string) => { const i = FACULTY_ORDER.indexOf(code); return i === -1 ? FACULTY_ORDER.length : i; };
// Présentation de chaque mention (utilisée si la mention n'a pas de description).
const MENTION_TEXT: Record<string, string> = {
  Gestion: "Comptabilité, finance, marketing et management des organisations : les bases pour travailler en entreprise, en administration ou créer son activité.",
  Informatique: "Programmation, développement web, bases de données et réseaux : une formation pratique, projet après projet.",
  Anglais: "Langue, communication et culture anglophones : pour l'enseignement, la traduction, le tourisme et les échanges internationaux.",
};

// Thème sombre : bleu nuit #0b1120 (fond), #0f172a (sections alternées), #162036 (cartes), rouge #e3262b.
const gray = "grayscale dark:grayscale-0"; // photos en noir et blanc, en couleur dans le thème sombre
const label = "text-[11px] font-medium uppercase tracking-[0.28em]";
const eyebrowColor = "text-neutral-500 dark:text-[#f87171]";
const titleColor = "text-black dark:text-white";
const textColor = "text-neutral-600 dark:text-slate-400";
const btnDark = "inline-flex items-center justify-center gap-2 bg-black px-7 py-3.5 text-sm font-medium tracking-wide text-white transition hover:bg-neutral-800 dark:bg-[#e3262b] dark:hover:bg-[#c81e23]";
const btnLine = "inline-flex items-center justify-center gap-2 border border-black px-7 py-3.5 text-sm font-medium tracking-wide text-black transition hover:bg-black hover:text-white dark:border-white/30 dark:text-white dark:hover:bg-white dark:hover:text-[#0b1120]";

// ─── Menu du haut : sobre, avec le choix du thème ────────────────────────────
function HomeHeader({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 backdrop-blur-md dark:border-white/10 dark:bg-[#0b1120]/90">
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-3" aria-label="Université Références — accueil">
          <Logo size={40} />
          <span className="leading-none">
            <span className={`block whitespace-nowrap text-[15px] font-semibold tracking-tight sm:text-[17px] ${titleColor}`} style={serif}>Université Références</span>
            <span className={`mt-1 block ${eyebrowColor} ${label} !text-[9px]`}>Antananarivo</span>
          </span>
        </a>
        <nav className="ml-auto hidden items-center gap-8 lg:flex">
          {NAV.slice(1).map((n) => (
            <a key={n.href} href={n.href.replace(/^\//, "") || "/"} className={`group relative py-2 text-neutral-600 transition hover:text-black dark:text-slate-300 dark:hover:text-white ${label}`}>
              {n.label}
              <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-black transition-transform duration-300 group-hover:scale-x-100 dark:bg-[#e3262b]" />
            </a>
          ))}
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
          {NAV.slice(1).map((n) => (
            <a key={n.href} href={n.href.replace(/^\//, "") || "/"} onClick={() => setOpen(false)} className={`block border-b border-neutral-100 py-3.5 text-neutral-700 dark:border-white/5 dark:text-slate-200 ${label}`}>{n.label}</a>
          ))}
          <Link to="/choice" className={`mt-4 flex w-full ${btnDark}`}>{user ? "Mon espace" : "Espace numérique"}</Link>
        </nav>
      )}
    </header>
  );
}

function SectionTitle({ eyebrow, title, light = false, center = false }: { eyebrow: string; title: React.ReactNode; light?: boolean; center?: boolean }) {
  return (
    <div className={center ? "text-center" : ""}>
      <p className={`${label} ${light ? "text-neutral-400 dark:text-[#f87171]" : eyebrowColor}`}>{eyebrow}</p>
      <h2 className={`mt-4 text-4xl font-semibold leading-[1.1] sm:text-5xl ${light ? "text-white" : titleColor}`} style={serif}>{title}</h2>
    </div>
  );
}

function EventItem({ ev }: { ev: UniversityEvent }) {
  const img = eventImage(ev.imageUrl);
  const start = new Date(ev.startAt);
  const past = new Date(ev.endAt ?? ev.startAt).getTime() < Date.now();
  return (
    <article className="group">
      <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100 dark:bg-[#162036]">
        {img && <img src={img} alt="" className={`h-full w-full object-cover ${gray} transition duration-700 group-hover:scale-[1.03]`} />}
        <div className="absolute left-0 top-0 bg-white px-4 py-3 text-center">
          <div className="text-2xl font-semibold leading-none text-black dark:text-[#e3262b]" style={serif}>{start.getDate()}</div>
          <div className={`mt-1 text-neutral-500 ${label} !text-[9px]`}>{start.toLocaleDateString("fr-FR", { month: "short" })}</div>
        </div>
        {past && <span className={`absolute right-3 top-3 bg-black/70 px-2 py-1 text-white ${label} !text-[9px]`}>Passé</span>}
      </div>
      <h3 className={`mt-5 text-xl font-semibold leading-snug ${titleColor}`} style={serif}>{ev.title}</h3>
      <p className="mt-2 text-sm text-neutral-500 dark:text-slate-400">{fmtDate(ev.startAt)}{ev.location ? ` · ${ev.location}` : ""}</p>
      {ev.description && <p className={`mt-3 line-clamp-3 text-sm leading-relaxed ${textColor}`}>{ev.description}</p>}
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function Home() {
  const { dark, toggle } = useSiteTheme();
  const facebook = useFacebookUrl();
  const { data } = useQuery({
    queryKey: ["public", "home"],
    queryFn: () => api<HomeData>("/online/public/home", { auth: false }),
    staleTime: 60_000,
  });
  // Événements publiés par le Super administrateur / le Secrétariat
  const events = useQuery({
    queryKey: ["events", "public"],
    queryFn: () => api<UniversityEvent[]>("/events/public?limit=3", { auth: false }),
    staleTime: 60_000,
  });
  const faculties = [...(data?.faculties ?? [])].sort((a, b) => facultyRank(a.code) - facultyRank(b.code) || a.name.localeCompare(b.name));
  const eventList = (events.data ?? []).slice(0, 3);

  return (
    <div className={dark ? "dark" : ""}>
    <div id="top" className="min-h-screen bg-white text-neutral-900 antialiased dark:bg-[#0b1120] dark:text-slate-200">
      <HomeHeader dark={dark} onToggleTheme={toggle} />

      {/* ── BANNIÈRE ────────────────────────────────────────────────────── */}
      <section className="relative isolate flex min-h-[calc(100svh-80px)] items-end overflow-hidden bg-black dark:bg-[#0b1120]">
        <img src={IMG.hero} alt="" className={`absolute inset-0 -z-10 h-full w-full object-cover ${gray} opacity-70`} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/40 to-black/10 dark:from-[#0b1120] dark:via-[#0b1120]/50" />
        <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-32 sm:px-6 sm:pb-28 lg:px-8">
          <p className={`${label} text-neutral-300 dark:text-[#f87171]`}>Université Références · Antananarivo</p>
          <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] text-white sm:text-7xl lg:text-8xl" style={serif}>
            Apprendre,<br />réussir, s'engager.
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-neutral-300">
            L'Université Références forme ses étudiants en Gestion, en Informatique et en Anglais, en présentiel à
            Antananarivo ou à distance. Chaque étudiant est suivi de près : cours, notes, présences et écolage, avec ses
            parents informés à chaque étape.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a href="#formations" className="inline-flex items-center gap-2 bg-white px-7 py-3.5 text-sm font-medium tracking-wide text-black transition hover:bg-neutral-200 dark:bg-[#e3262b] dark:text-white dark:hover:bg-[#c81e23]">
              Découvrir nos formations <ArrowRight className="h-4 w-4" />
            </a>
            <a href="/classroom?candidater=1" className="inline-flex items-center gap-2 border border-white/70 px-7 py-3.5 text-sm font-medium tracking-wide text-white transition hover:bg-white hover:text-black">
              Déposer ma candidature
            </a>
          </div>
        </div>
      </section>

      {/* ── L'UNIVERSITÉ ────────────────────────────────────────────────── */}
      <section id="universite" className="scroll-mt-20">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 py-28 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="relative pb-12">
            <img src={IMG.about} alt="Étudiants de l'Université Références" className={`aspect-[4/3] w-full object-cover lg:aspect-[5/6] ${gray}`} />
            <figure className="absolute bottom-0 right-0 max-w-xs bg-black p-7 dark:bg-[#e3262b] sm:-right-8">
              <blockquote className="text-lg italic leading-snug text-white" style={serif}>
                « Former aujourd'hui les compétences dont Madagascar a besoin demain. »
              </blockquote>
            </figure>
          </div>
          <div>
            <SectionTitle eyebrow="L'Université" title="Une université exigeante et proche de ses étudiants" />
            <p className={`mt-8 text-lg leading-relaxed ${textColor}`}>
              Installée à Antananarivo, l'Université Références réunit trois facultés : Sciences Économiques et de
              Gestion, Sciences et Technologies, Lettres et Langues. Nos enseignants, docteurs et professeurs,
              accompagnent chaque promotion du premier semestre jusqu'au diplôme.
            </p>
            <dl className="mt-10 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-white/10 dark:border-white/10">
              {[
                ["01", "Deux façons d'étudier", "En salle sur le campus, ou en ligne avec vidéos, documents et tests."],
                ["02", "Un corps enseignant qualifié", "Étudiants et parents consultent les titres et les CV des enseignants."],
                ["03", "Une scolarité transparente", "Notes, présences et écolage consultables en ligne, par l'étudiant comme par ses parents."],
              ].map(([n, t, d]) => (
                <div key={n} className="flex gap-6 py-5">
                  <dt className="text-sm text-neutral-400 dark:text-[#f87171]" style={serif}>{n}</dt>
                  <dd>
                    <p className={`font-semibold ${titleColor}`}>{t}</p>
                    <p className={`mt-1 text-sm leading-relaxed ${textColor}`}>{d}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ── FORMATIONS ──────────────────────────────────────────────────── */}
      <section id="formations" className="scroll-mt-20 bg-neutral-50 dark:bg-[#0f172a]">
        <div className="mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionTitle eyebrow="Formations" title="Nos mentions" />
            <p className={`max-w-md ${textColor}`}>Trois mentions, accessibles en présentiel ou en ligne.</p>
          </div>
          <div className="mt-16 grid gap-px bg-neutral-200 dark:bg-white/10 md:grid-cols-3">
            {faculties.map((f) => (
              <article key={f.id} className="group flex flex-col bg-white dark:bg-[#162036]">
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={FACULTY_IMG[f.code] ?? FACULTY_FALLBACK} alt="" className={`h-full w-full object-cover ${gray} transition duration-700 group-hover:scale-[1.03]`} />
                </div>
                <div className="flex flex-1 flex-col p-8">
                  <p className={`${label} text-neutral-400 dark:text-[#f87171]`}>{f.name}</p>
                  {f.mentions.length === 0 && <p className="mt-4 text-sm italic text-neutral-500 dark:text-slate-400">Mentions en préparation.</p>}
                  {f.mentions.map((m) => (
                    <div key={m.id} className="mt-4">
                      <h3 className={`text-2xl font-semibold ${titleColor}`} style={serif}>{m.name}</h3>
                      <p className={`mt-3 text-sm leading-relaxed ${textColor}`}>{MENTION_TEXT[m.name] ?? m.description}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <div className="mt-14 flex flex-wrap gap-4">
            <a href="/classroom?candidater=1" className={btnDark}><UserPlus className="h-4 w-4" /> Déposer ma candidature</a>
            <Link to="/online" className={btnLine}><MonitorPlay className="h-4 w-4" /> Cours en ligne</Link>
          </div>
        </div>
      </section>

      {/* ── AGENDA ──────────────────────────────────────────────────────── */}
      <section id="actualites" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <SectionTitle eyebrow="Actualité" title="Agenda de l'université" />
              <p className={`mt-5 max-w-xl ${textColor}`}>Rentrée, examens, conférences, soutenances : les rendez-vous de l'Université Références.</p>
            </div>
            <a href="/actualites" className={`group inline-flex items-center gap-2 border-b border-black pb-1 text-black dark:border-[#f87171] dark:text-[#f87171] ${label}`}>
              Toutes les actualités <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
          {events.isLoading ? null : eventList.length === 0 ? (
            <p className="mt-14 border-t border-neutral-200 pt-10 text-neutral-500 dark:border-white/10 dark:text-slate-400">Les prochains rendez-vous de l'université seront publiés ici.</p>
          ) : (
            <div className="mt-16 grid gap-12 md:grid-cols-3">{eventList.map((ev) => <EventItem key={ev.id} ev={ev} />)}</div>
          )}
        </div>
      </section>

      {/* ── VIE AU CAMPUS ───────────────────────────────────────────────── */}
      <section className="bg-black dark:bg-[#0f172a]">
        <div className="mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
          <div className="grid items-end gap-8 lg:grid-cols-2">
            <SectionTitle eyebrow="Vie au campus" title="Plus qu'un lieu d'étude." light />
            <p className="text-lg leading-relaxed text-neutral-400">
              Associations, culture, sport et entraide : ici, chacun trouve sa place et construit son réseau.
            </p>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {IMG.campus.map((c) => (
              <div key={c.title} className="group relative overflow-hidden">
                <img src={c.img} alt="" className={`aspect-[4/5] w-full object-cover ${gray} opacity-80 transition duration-700 group-hover:scale-[1.03] group-hover:opacity-100`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <h3 className="absolute bottom-6 left-6 text-2xl font-semibold text-white" style={serif}>{c.title}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PAR OÙ COMMENCER ────────────────────────────────────────────── */}
      <section id="contact" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
          <SectionTitle eyebrow="Contact" title="Par où commencer ?" />
          <div className="mt-16 grid gap-px bg-neutral-200 dark:bg-white/10 md:grid-cols-3">
            {[
              { href: "/classroom?candidater=1", Icon: UserPlus, t: "Candidater", d: "Créez votre dossier en ligne, choisissez votre mention : le secrétariat des admissions vous répond.", cta: "Déposer ma candidature" },
              { href: "/classroom", Icon: Building2, t: "Espace université", d: "Étudiants, parents et enseignants : connectez-vous à votre espace.", cta: "Se connecter" },
              { href: "/online", Icon: MonitorPlay, t: "Cours en ligne", d: "Cours certifiants ouverts à tous, à suivre à votre rythme.", cta: "Explorer les cours" },
            ].map(({ href, Icon, t, d, cta }) => (
              <a key={t} href={href} className="group flex flex-col bg-white p-10 transition hover:bg-neutral-50 dark:bg-[#162036] dark:hover:bg-[#1c2944]">
                <Icon className="h-6 w-6 text-black dark:text-[#f87171]" strokeWidth={1.5} />
                <h3 className={`mt-8 text-2xl font-semibold ${titleColor}`} style={serif}>{t}</h3>
                <p className={`mt-3 flex-1 text-sm leading-relaxed ${textColor}`}>{d}</p>
                <span className={`mt-8 inline-flex items-center gap-2 ${titleColor} ${label}`}>
                  {cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── ADRESSE ─────────────────────────────────────────────────────── */}
      <section id="adresse" className="scroll-mt-20 bg-neutral-50 dark:bg-[#0f172a]">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-28 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:px-8">
          <div className="flex flex-col justify-center">
            <SectionTitle eyebrow="Adresse" title="Nous trouver" />
            <ul className="mt-8 space-y-4 text-neutral-700 dark:text-slate-300">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.5} />
                <span>Université Références<br />{CONTACT.address}<br />{CONTACT.city}</span>
              </li>
              <li><a href={CONTACT.phoneHref} className="flex items-center gap-3 underline-offset-4 hover:underline"><Phone className="h-5 w-5 shrink-0" strokeWidth={1.5} /> {CONTACT.phone}</a></li>
              <li><a href={`mailto:${CONTACT.email}`} className="flex items-center gap-3 break-all underline-offset-4 hover:underline"><Mail className="h-5 w-5 shrink-0" strokeWidth={1.5} /> {CONTACT.email}</a></li>
              <li><a href={facebook} target="_blank" rel="noreferrer" className="flex items-center gap-3 underline-offset-4 hover:underline"><Facebook className="h-5 w-5 shrink-0" strokeWidth={1.5} /> Suivez-nous sur Facebook</a></li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-4">
              <a href={MAP_ROUTE} target="_blank" rel="noreferrer" className={btnDark}><Navigation className="h-4 w-4" /> Itinéraire</a>
              <a href={MAP.link} target="_blank" rel="noreferrer" className={btnLine}>Ouvrir dans Google Maps</a>
            </div>
          </div>
          <iframe
            title="Plan d'accès — Université Références"
            src={MAP_EMBED}
            className={`h-[440px] w-full border-0 ${gray}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </section>

      {/* Pied de page : noir en thème clair, bleu nuit et rouge en thème sombre */}
      <SiteFooter mono={!dark} />
    </div>
    </div>
  );
}
