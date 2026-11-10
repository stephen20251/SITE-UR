// Sections de la page d'accueil pensées pour attirer les futurs étudiants et leurs
// parents : chiffres clés, galerie « Vie au campus », témoignages et questions
// fréquentes (saisis par l'administration), appel final à candidater.
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, Facebook, Phone, Quote, Star, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { CONTACT } from "@/lib/contact";
import { mediaUrl } from "@/components/online/mooc-card";
import { UI, serif, useFacebookUrl } from "@/components/site-layout";

const PHOTO = "/images/accueil";

// ─── Chiffres clés : posés à cheval sur le bas de la bannière ────────────────
export function KeyFacts({ domains, mentions, years }: { domains: number; mentions: number; years: number }) {
  const facts = [
    { v: domains || 3, l: "Domaines de formation" },
    { v: mentions || 3, l: "Mentions" },
    { v: `${years || 3} ans`, l: "Pour obtenir la Licence" },
    { v: "2", l: "Façons d'étudier : sur place ou en ligne" },
  ];
  return (
    <div className="relative z-10 mx-auto -mt-14 max-w-6xl px-4 sm:px-6 lg:px-8">
      <dl className="grid grid-cols-2 overflow-hidden rounded-2xl bg-white shadow-[0_30px_60px_-25px_rgba(20,32,74,0.45)] ring-1 ring-slate-200 dark:bg-[#162036] dark:ring-white/10 lg:grid-cols-4">
        {facts.map((f, i) => (
          <div key={f.l} className={`px-6 py-7 text-center ${i % 2 === 0 ? "border-r" : ""} ${i < 2 ? "border-b lg:border-b-0" : ""} ${i === 1 ? "lg:border-r" : ""} border-slate-200 dark:border-white/10`}>
            <dt className="sr-only">{f.l}</dt>
            <dd>
              <span className="block text-4xl font-semibold text-[#e3262b] sm:text-5xl" style={serif}>{f.v}</span>
              <span className={`mt-2 block text-sm ${UI.text}`}>{f.l}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── Vie au campus : galerie en mosaïque, légende au survol ──────────────────
const CAMPUS = [
  { img: `${PHOTO}/campus-esprit-equipe.jpg`, t: "Esprit d'équipe", d: "Une promotion soudée, qui avance ensemble.", cls: "md:col-span-2 md:row-span-2" },
  { img: `${PHOTO}/campus-vie-etudiante.jpg`, t: "Vie étudiante", d: "Entraide, rencontres et projets entre étudiants.", cls: "" },
  { img: `${PHOTO}/campus-travaux-pratiques.jpg`, t: "Travaux pratiques", d: "Apprendre en manipulant, en testant, en construisant.", cls: "" },
  { img: `${PHOTO}/campus-numerique.jpg`, t: "Campus numérique", d: "Cours, ressources et suivi accessibles en ligne.", cls: "md:col-span-2" },
];

export function CampusGallery() {
  const facebook = useFacebookUrl();
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#0b1430] to-[#14204a] dark:from-[#0f172a] dark:to-[#0f172a]">
      {/* halo rouge discret */}
      <div className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-[#e3262b]/20 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
        <div className="grid items-end gap-8 lg:grid-cols-2">
          <div>
            <p className={`${UI.label} text-[#f87171]`}>Vie au campus</p>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.1] text-white sm:text-5xl" style={serif}>Plus qu'un lieu d'étude.</h2>
          </div>
          <div className="lg:text-right">
            <p className="text-lg leading-relaxed text-slate-300 lg:ml-auto lg:max-w-md">
              Associations, culture, sport et entraide : ici, chacun trouve sa place et construit son réseau.
            </p>
            <a href={facebook} target="_blank" rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 text-sm font-medium text-white transition hover:border-white hover:bg-white hover:text-[#14204a]">
              <Facebook className="h-4 w-4" /> Suivre la vie du campus
            </a>
          </div>
        </div>
        <div className="mt-14 grid auto-rows-[220px] gap-4 md:grid-cols-4 md:auto-rows-[240px]">
          {CAMPUS.map((c) => (
            <figure key={c.t} className={`group relative overflow-hidden rounded-2xl ${c.cls}`}>
              <img src={c.img} alt={c.t} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b1430]/90 via-[#0b1430]/20 to-transparent" />
              <figcaption className="absolute inset-x-0 bottom-0 p-6">
                <span className="mb-3 block h-0.5 w-10 bg-[#e3262b] transition-all duration-500 group-hover:w-16" />
                <span className="block text-2xl font-semibold text-white" style={serif}>{c.t}</span>
                <span className="mt-1 block max-h-0 overflow-hidden text-sm text-slate-200 opacity-0 transition-all duration-500 group-hover:max-h-12 group-hover:opacity-100">{c.d}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Témoignages (administration de la plateforme en ligne → Témoignages) ────
type Testimonial = { id: string; name: string; role: string | null; avatar: string | null; content: string; rating: number };

export function Testimonials() {
  const { data = [] } = useQuery({
    queryKey: ["public", "testimonials"],
    queryFn: () => api<Testimonial[]>("/online/public/testimonials", { auth: false }),
    staleTime: 5 * 60_000,
  });
  if (data.length === 0) return null; // rien d'inventé : la section n'apparaît qu'avec de vrais témoignages
  return (
    <section className="bg-white dark:bg-[#0b1120]">
      <div className="mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
        <p className={`${UI.label} ${UI.eyebrow}`}>Témoignages</p>
        <h2 className={`mt-4 text-4xl font-semibold leading-[1.1] sm:text-5xl ${UI.title}`} style={serif}>Ils en parlent mieux que nous.</h2>
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.slice(0, 6).map((t) => (
            <figure key={t.id} className="relative flex flex-col rounded-2xl bg-[#f3f6fd] p-8 ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgba(20,32,74,0.4)] dark:bg-[#162036] dark:ring-white/10">
              <Quote className="h-8 w-8 text-[#e3262b]" />
              <div className="mt-4 flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-4 w-4 ${i <= t.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />)}
              </div>
              <blockquote className={`mt-4 flex-1 text-base leading-relaxed ${UI.text}`}>« {t.content} »</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                {t.avatar
                  ? <img src={mediaUrl(t.avatar)} alt="" className="h-11 w-11 rounded-full object-cover" />
                  : <span className="grid h-11 w-11 place-items-center rounded-full bg-[#14204a] text-sm font-semibold text-white">{t.name.slice(0, 1).toUpperCase()}</span>}
                <span>
                  <span className={`block font-semibold ${UI.title}`}>{t.name}</span>
                  {t.role && <span className={`block text-sm ${UI.muted}`}>{t.role}</span>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Questions fréquentes (administration de la plateforme en ligne → FAQ) ───
type Faq = { id: string; question: string; answer: string };

export function FaqSection() {
  const { data = [] } = useQuery({
    queryKey: ["public", "faq"],
    queryFn: () => api<Faq[]>("/online/public/faq", { auth: false }),
    staleTime: 5 * 60_000,
  });
  if (data.length === 0) return null;
  return (
    <section className={UI.altBg}>
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-28 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:px-8">
        <div>
          <p className={`${UI.label} ${UI.eyebrow}`}>Questions fréquentes</p>
          <h2 className={`mt-4 text-4xl font-semibold leading-[1.1] sm:text-5xl ${UI.title}`} style={serif}>Vous vous demandez…</h2>
          <p className={`mt-6 ${UI.text}`}>Une autre question ? Appelez-nous au{" "}
            <a href={CONTACT.phoneHref} className="font-semibold text-[#e3262b] hover:underline">{CONTACT.phone}</a>.
          </p>
        </div>
        <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-white/10 dark:border-white/10">
          {data.map((f) => (
            <details key={f.id} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 [&::-webkit-details-marker]:hidden">
                <span className={`text-lg font-semibold ${UI.title}`} style={serif}>{f.question}</span>
                <ChevronDown className="h-5 w-5 shrink-0 text-[#e3262b] transition-transform group-open:rotate-180" />
              </summary>
              <p className={`whitespace-pre-line pb-6 leading-relaxed ${UI.text}`}>{f.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Appel final : candidater ou appeler ─────────────────────────────────────
export function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden">
      <img src={`${PHOTO}/banniere.jpg`} alt="" aria-hidden className="absolute inset-0 -z-20 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#14204a]/95 via-[#14204a]/85 to-[#e3262b]/80" />
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-10 px-4 py-24 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="max-w-2xl">
          <p className={`${UI.label} text-[#fca5a5]`}>Rejoignez-nous</p>
          <h2 className="mt-4 text-4xl font-semibold leading-[1.1] text-white sm:text-5xl" style={serif}>Votre avenir commence ici.</h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-200">
            Déposez votre candidature en ligne en quelques minutes, ou appelez-nous : nous répondons à toutes vos questions.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <a href="/classroom?candidater=1"
            className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-semibold text-[#14204a] shadow-xl transition hover:-translate-y-0.5">
            <UserPlus className="h-4 w-4 text-[#e3262b]" /> Déposer ma candidature <ArrowRight className="h-4 w-4" />
          </a>
          <a href={CONTACT.phoneHref}
            className="inline-flex items-center gap-2 rounded-full border border-white/50 px-7 py-4 text-sm font-semibold text-white transition hover:bg-white/10">
            <Phone className="h-4 w-4" /> {CONTACT.phone}
          </a>
        </div>
      </div>
    </section>
  );
}

