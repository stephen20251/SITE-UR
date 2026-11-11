import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Building2, Facebook, GraduationCap, Handshake, Lightbulb, Mail, MapPin, MonitorPlay, Navigation, Phone, ShieldCheck, UserPlus, Users } from "lucide-react";
import { CONTACT } from "@/lib/contact";
import { api } from "@/lib/api";
import { eventImage, type UniversityEvent } from "@/lib/events";
import { FACEBOOK_URL, MAP, SITE_FONTS, SitePage, UI, fmtDate, serif, useFacebookUrl } from "@/components/site-layout";
import { HomeHero } from "@/components/home-hero";
import { CampusGallery, FaqSection, FinalCta, KeyFacts, Testimonials } from "@/components/home-sections";
import { MentionPanel } from "@/components/mention-panel";
import { mediaUrl } from "@/components/online/mooc-card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Université Références (University Reference) — Antananarivo" },
      { name: "description", content: "Université Références (University Reference), à Antananarivo : formations en Gestion, en Informatique et en Anglais, en présentiel et en ligne." },
      { property: "og:url", content: "https://univreference.com/" },
    ],
    links: [
      { rel: "stylesheet", href: SITE_FONTS },
      { rel: "canonical", href: "https://univreference.com/" },
    ],
    // Fiche d'identité lue par Google (nom, logo, adresse, contact, réseaux)
    scripts: [{ type: "application/ld+json", children: JSON.stringify(ORGANIZATION_LD) }],
  }),
  component: Home,
});

const ORGANIZATION_LD = {
  "@context": "https://schema.org",
  "@type": "CollegeOrUniversity",
  name: "Université Références",
  alternateName: ["University Reference", "University Références", "UR"],
  url: "https://univreference.com/",
  logo: "https://univreference.com/icons/icon-512.png",
  image: "https://univreference.com/images/partage.jpg",
  description: "Établissement d'enseignement supérieur à Antananarivo : Gestion, Informatique et Anglais, en présentiel et en ligne.",
  email: CONTACT.email,
  telephone: CONTACT.phone,
  address: {
    "@type": "PostalAddress",
    streetAddress: CONTACT.address,
    addressLocality: "Antananarivo",
    addressCountry: "MG",
  },
  sameAs: [FACEBOOK_URL],
};

// Page d'accueil. Thème clair (noir et blanc) ou sombre (bleu nuit et rouge) : voir SitePage.

type HomeData = {
  faculties: { id: string; name: string; code: string; mentions: { id: string; name: string; description: string | null; tagline: string | null; imageUrl: string | null }[] }[];
};

const MAP_EMBED = `https://www.google.com/maps?q=${MAP.lat},${MAP.lng}&hl=fr&z=17&output=embed`;
const MAP_ROUTE = `https://www.google.com/maps/dir/?api=1&destination=${MAP.lat},${MAP.lng}`;

// Photos de l'université (originaux dans image-UR/, réduites pour le web dans public/images/accueil/)
const PHOTO = "/images/accueil";
const IMG = {
  about: `${PHOTO}/portrait-universite.jpg`, // « Portrait promotionnel dans un cercle bleu en pointillés »
  admissions: `${PHOTO}/admissions.jpg`,
};
// Photo par faculté (selon son code), sinon la photo générale de l'université.
const FACULTY_IMG: Record<string, string> = {
  "FAC-SEG": `${PHOTO}/mention-gestion.jpg`,
  "FAC-ST": `${PHOTO}/mention-informatique.jpg`,
  "FAC-LL": `${PHOTO}/mention-anglais.jpg`,
};
const FACULTY_FALLBACK = `${PHOTO}/universite-etudiante.jpg`;
// Ordre d'affichage : Gestion, Informatique, puis Langues (Anglais) ; les autres ensuite.
const FACULTY_ORDER = ["FAC-SEG", "FAC-ST", "FAC-LL"];
const facultyRank = (code: string) => { const i = FACULTY_ORDER.indexOf(code); return i === -1 ? FACULTY_ORDER.length : i; };
// Présentation de chaque mention (utilisée si la mention n'a pas de description).
const MENTION_TEXT: Record<string, string> = {
  Gestion: "Comptabilité, finance, marketing et management des organisations : les bases pour travailler en entreprise, en administration ou créer son activité.",
  Informatique: "Programmation, développement web, bases de données et réseaux : une formation pratique, projet après projet.",
  Anglais: "Langue, communication et culture anglophones : pour l'enseignement, la traduction, le tourisme et les échanges internationaux.",
};

// Valeurs de l'université (dépliant officiel)
const VALUES = [
  { Icon: GraduationCap, t: "Excellence académique", d: "Des exigences élevées, au service de la réussite." },
  { Icon: ShieldCheck, t: "Intégrité", d: "L'honnêteté et la rigueur dans chaque travail." },
  { Icon: Lightbulb, t: "Innovation", d: "Des méthodes et des outils tournés vers l'avenir." },
  { Icon: Handshake, t: "Respect", d: "Une communauté où chacun trouve sa place." },
  { Icon: Users, t: "Esprit d'équipe", d: "Apprendre ensemble, réussir ensemble." },
];
// Étapes de la candidature
const STEPS = [
  { t: "Candidature en ligne", d: "Créez votre dossier et choisissez votre mention, en quelques minutes." },
  { t: "Étude du dossier", d: "Le secrétariat des admissions examine votre candidature et vous répond." },
  { t: "Inscription", d: "Une fois admis, finalisez votre inscription et préparez votre rentrée." },
];

// Classes de style partagées avec les autres pages publiques (voir site-layout).
const { photo: gray, label, eyebrow: eyebrowColor, title: titleColor, text: textColor, btnDark, btnLine } = UI;

function SectionTitle({ eyebrow, title, light = false, center = false }: { eyebrow: string; title: React.ReactNode; light?: boolean; center?: boolean }) {
  return (
    <div className={center ? "text-center" : ""}>
      <p className={`${label} ${light ? "text-[#f87171]" : eyebrowColor}`}>{eyebrow}</p>
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
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-[#162036]">
        {img && <img src={img} alt="" className={`h-full w-full object-cover ${gray} transition duration-700 group-hover:scale-[1.03]`} />}
        <div className="absolute left-0 top-0 bg-white px-4 py-3 text-center">
          <div className="text-2xl font-semibold leading-none text-[#e3262b]" style={serif}>{start.getDate()}</div>
          <div className={`mt-1 text-slate-500 ${label} !text-[9px]`}>{start.toLocaleDateString("fr-FR", { month: "short" })}</div>
        </div>
        {past && <span className={`absolute right-3 top-3 bg-[#14204a]/70 px-2 py-1 text-white ${label} !text-[9px]`}>Passé</span>}
      </div>
      <h3 className={`mt-5 text-xl font-semibold leading-snug ${titleColor}`} style={serif}>{ev.title}</h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{fmtDate(ev.startAt)}{ev.location ? ` · ${ev.location}` : ""}</p>
      {ev.description && <p className={`mt-3 line-clamp-3 text-sm leading-relaxed ${textColor}`}>{ev.description}</p>}
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function Home() {
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
  // Mention ouverte dans la fenêtre de détail
  const [openMention, setOpenMention] = useState<{ id: string; image: string } | null>(null);

  return (
    <SitePage>

      {/* ── BANNIÈRE : trois photos (voir home-hero) ─────────────────────── */}
      <HomeHero />
      <KeyFacts domains={faculties.length} mentions={faculties.reduce((n, fac) => n + fac.mentions.length, 0)} years={3} />

      {/* ── L'UNIVERSITÉ ────────────────────────────────────────────────── */}
      <section id="universite" className="scroll-mt-20">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 py-28 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="relative pb-12">
            <img src={IMG.about} alt="Étudiante de l'Université Références" className={`aspect-[4/5] w-full rounded-2xl object-cover object-top shadow-[0_30px_60px_-30px_rgba(20,32,74,0.6)] sm:aspect-[3/4] lg:aspect-[2/3] ${gray}`} />
            <figure className="absolute bottom-0 right-0 max-w-xs bg-[#e3262b] p-7 shadow-xl sm:-right-8">
              <blockquote className="text-lg italic leading-snug text-white" style={serif}>
                « Former aujourd'hui les compétences dont Madagascar a besoin demain. »
              </blockquote>
            </figure>
          </div>
          <div>
            <SectionTitle eyebrow="L'Université" title="Une formation exigeante, tournée vers l'emploi" />
            <p className={`mt-8 text-lg leading-relaxed ${textColor}`}>
              Notre ambition : offrir un enseignement moderne, pratique et accessible, qui permet à chaque étudiant de
              développer pleinement son potentiel académique et professionnel. L'université réunit trois domaines :
              Sciences de la Société, Sciences de l’Ingénieur, Formation pratique et professionnelle.
            </p>
            <dl className="mt-10 divide-y divide-slate-200 border-y border-slate-200 dark:divide-white/10 dark:border-white/10">
              {[
                ["01", "Une pédagogie innovante", "Projets, travaux pratiques et études de cas : on apprend en faisant."],
                ["02", "Des enseignants expérimentés", "Ils allient exigence académique et connaissance du monde professionnel."],
                ["03", "Des diplômés prêts pour l'emploi", "Des compétences recherchées, au niveau national comme à l'international."],
              ].map(([n, t, d]) => (
                <div key={n} className="flex gap-6 py-5">
                  <dt className="text-sm text-[#e3262b] dark:text-[#f87171]" style={serif}>{n}</dt>
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
      <section id="formations" className="scroll-mt-20 bg-slate-50 dark:bg-[#0f172a]">
        <div className="mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionTitle eyebrow="Formations" title="Nos mentions" />
            <p className={`max-w-md ${textColor}`}>Trois mentions, accessibles en présentiel ou en ligne.</p>
          </div>
          <div className="mt-16 grid gap-px bg-slate-200 dark:bg-white/10 md:grid-cols-3">
            {faculties.map((f) => {
              // Photo : celle de la mention (administration), sinon celle du domaine.
              const first = f.mentions[0];
              const image = (first?.imageUrl && mediaUrl(first.imageUrl)) || FACULTY_IMG[f.code] || FACULTY_FALLBACK;
              const open = (id: string) => setOpenMention({ id, image });
              return (
                <article key={f.id} className="group flex flex-col bg-white dark:bg-[#162036]">
                  <button type="button" disabled={!first} onClick={() => first && open(first.id)} tabIndex={-1} aria-hidden
                    className="relative aspect-[4/3] overflow-hidden enabled:cursor-pointer">
                    <img src={image} alt="" className={`h-full w-full object-cover ${gray} transition duration-700 group-hover:scale-[1.03]`} />
                    <span className="absolute inset-0 bg-[#14204a]/0 transition duration-500 group-hover:bg-[#14204a]/10" />
                  </button>
                  <div className="flex flex-1 flex-col p-8">
                    <p className={`${label} text-[#e3262b] dark:text-[#f87171]`}>{f.name}</p>
                    {f.mentions.length === 0 && <p className="mt-4 text-sm italic text-slate-500 dark:text-slate-400">Mentions en préparation.</p>}
                    {f.mentions.map((m) => (
                      <button key={m.id} type="button" onClick={() => open(m.id)} aria-haspopup="dialog"
                        className="group/m mt-4 flex flex-1 flex-col text-left">
                        <h3 className={`text-2xl font-semibold ${titleColor}`} style={serif}>{m.name}</h3>
                        <p className={`mt-3 line-clamp-4 text-sm leading-relaxed ${textColor}`}>{m.tagline || MENTION_TEXT[m.name] || m.description}</p>
                        <span className={`mt-auto inline-flex items-center gap-2 pt-6 ${label} !text-[10px] text-[#e3262b] dark:text-[#f87171]`}>
                          <span className="border-b border-transparent pb-0.5 transition group-hover/m:border-current">Découvrir la mention</span>
                          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover/m:translate-x-1" />
                        </span>
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-14 flex flex-wrap gap-4">
            <a href="/classroom?candidater=1" className={btnDark}><UserPlus className="h-4 w-4" /> Déposer ma candidature</a>
            <Link to="/online" className={btnLine}><MonitorPlay className="h-4 w-4" /> Cours en ligne</Link>
          </div>
        </div>
      </section>

      {/* ── POURQUOI NOUS CHOISIR : devise et valeurs ───────────────────── */}
      <section className="bg-gradient-to-br from-[#14204a] to-[#0b1430] dark:from-[#0f172a] dark:to-[#0f172a]">
        <div className="mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
          <p className={`${label} text-[#f87171]`}>Pourquoi l'Université Références</p>
          <blockquote className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.1] text-white sm:text-6xl" style={serif}>
            « Investir le présent, gagner l'avenir. »
          </blockquote>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-slate-400">
            Former des professionnels qualifiés grâce à une pédagogie innovante, des enseignants expérimentés et un
            accompagnement personnalisé.
          </p>
          <div className="mt-16 grid gap-px bg-white/15 sm:grid-cols-2 lg:grid-cols-5">
            {VALUES.map(({ Icon, t, d }) => (
              <div key={t} className="bg-[#14204a] p-8 transition hover:bg-[#1c2a5e] dark:bg-[#0f172a] sm:last:col-span-2 lg:last:col-span-1">
                <Icon className="h-7 w-7 text-[#f87171]" strokeWidth={1.25} />
                <h3 className="mt-6 text-xl font-semibold text-white" style={serif}>{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ADMISSIONS : la candidature en trois étapes ─────────────────── */}
      <section id="admissions" className="scroll-mt-20">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 py-28 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:px-8">
          <div>
            <SectionTitle eyebrow="Admissions" title="Rejoindre l'Université Références" />
            <p className={`mt-8 max-w-xl text-lg leading-relaxed ${textColor}`}>La candidature se fait entièrement en ligne, en trois étapes.</p>
            <ol className="mt-12 space-y-10">
              {STEPS.map((s, i) => (
                <li key={s.t} className="flex gap-8">
                  <span className="w-12 shrink-0 text-5xl font-semibold leading-none text-[#e3262b]" style={serif}>{i + 1}</span>
                  <div className="border-t border-slate-200 pt-4 dark:border-white/10">
                    <h3 className={`text-xl font-semibold ${titleColor}`} style={serif}>{s.t}</h3>
                    <p className={`mt-2 text-sm leading-relaxed ${textColor}`}>{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-12 flex flex-wrap gap-4">
              <a href="/classroom?candidater=1" className={btnDark}><UserPlus className="h-4 w-4" /> Déposer ma candidature</a>
              <a href="#adresse" className={btnLine}>Une question ? Contactez-nous</a>
            </div>
          </div>
          <img src={IMG.admissions} alt="Étudiante de l'Université Références" className={`aspect-[4/5] w-full object-cover object-[70%_center] ${gray}`} />
        </div>
      </section>

      {openMention && (
        <MentionPanel mentionId={openMention.id} fallbackImage={openMention.image} onClose={() => setOpenMention(null)} />
      )}

      {/* ── AGENDA ──────────────────────────────────────────────────────── */}
      <section id="actualites" className={`scroll-mt-20 ${UI.altBg}`}>
        <div className="mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <SectionTitle eyebrow="Actualité" title="Agenda de l'université" />
              <p className={`mt-5 max-w-xl ${textColor}`}>Les rendez-vous de l'Université Références.</p>
            </div>
            <a href="/actualites" className={`group inline-flex items-center gap-2 border-b border-[#e3262b] pb-1 text-[#e3262b] dark:border-[#f87171] dark:text-[#f87171] ${label}`}>
              Toutes les actualités <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
          {events.isLoading ? null : eventList.length === 0 ? (
            <p className="mt-14 border-t border-slate-200 pt-10 text-slate-500 dark:border-white/10 dark:text-slate-400">Les prochains rendez-vous de l'université seront publiés ici.</p>
          ) : (
            <div className="mt-16 grid gap-12 md:grid-cols-3">{eventList.map((ev) => <EventItem key={ev.id} ev={ev} />)}</div>
          )}
        </div>
      </section>

      {/* ── VIE AU CAMPUS (galerie) et TÉMOIGNAGES (administration) ──────── */}
      <CampusGallery />
      <Testimonials />

      {/* ── PAR OÙ COMMENCER ────────────────────────────────────────────── */}
      <section id="contact" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
          <SectionTitle eyebrow="Contact" title="Par où commencer ?" />
          <div className="mt-16 grid gap-px bg-slate-200 dark:bg-white/10 md:grid-cols-3">
            {[
              { href: "/classroom?candidater=1", Icon: UserPlus, t: "Candidater", d: "Créez votre dossier en ligne, choisissez votre mention : le secrétariat des admissions vous répond.", cta: "Déposer ma candidature" },
              { href: "/classroom", Icon: Building2, t: "Espace université", d: "Étudiants, parents et enseignants : connectez-vous à votre espace.", cta: "Se connecter" },
              { href: "/online", Icon: MonitorPlay, t: "Cours en ligne", d: "Cours certifiants ouverts à tous, à suivre à votre rythme.", cta: "Explorer les cours" },
            ].map(({ href, Icon, t, d, cta }) => (
              <a key={t} href={href} className="group flex flex-col bg-white p-10 transition hover:bg-slate-50 dark:bg-[#162036] dark:hover:bg-[#1c2944]">
                <Icon className="h-6 w-6 text-[#e3262b] dark:text-[#f87171]" strokeWidth={1.5} />
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

      {/* ── QUESTIONS FRÉQUENTES (administration, masquée si vide) ───────── */}
      <FaqSection />

      {/* ── ADRESSE ─────────────────────────────────────────────────────── */}
      <section id="adresse" className="scroll-mt-20 bg-slate-50 dark:bg-[#0f172a]">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-28 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:px-8">
          <div className="flex flex-col justify-center">
            <SectionTitle eyebrow="Contact" title="Nous trouver" />
            <ul className="mt-8 space-y-4 text-slate-700 dark:text-slate-300">
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

      {/* ── APPEL FINAL ─────────────────────────────────────────────────── */}
      <FinalCta />
    </SitePage>
  );
}
