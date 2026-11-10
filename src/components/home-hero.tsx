// Bannière de l'accueil : trois photos qui se succèdent en fondu, avec un zoom lent,
// un titre propre à chaque photo et des onglets numérotés qui montrent la progression.
// - Changement automatique toutes les 7 secondes (à la fin de la barre de progression).
// - Pause quand la souris est sur la bannière.
// - Si le visiteur a demandé à réduire les animations : ni zoom, ni défilement automatique.
import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { UI, serif } from "@/components/site-layout";

const PHOTO = "/images/accueil";

const SLIDES = [
  {
    img: `${PHOTO}/banniere.jpg`,
    tab: "L'université",
    eyebrow: "Université Références · Antananarivo",
    title: <>Apprendre,<br />réussir, s'engager.</>,
    text: "Établissement d'enseignement supérieur, nous formons des étudiants compétents, responsables et innovants, prêts pour le marché du travail national et international.",
  },
  {
    img: `${PHOTO}/banniere-pratique.jpg`,
    tab: "La pratique",
    eyebrow: "Gestion · Informatique · Anglais",
    title: <>Apprendre<br />en faisant.</>,
    text: "Projets, travaux pratiques et études de cas : des formations concrètes, en présentiel à Antananarivo ou en ligne.",
  },
  {
    img: `${PHOTO}/banniere-cours.jpg`,
    tab: "L'accompagnement",
    eyebrow: "Investir le présent, gagner l'avenir",
    title: <>L'exigence au service<br />de votre réussite.</>,
    text: "Des enseignants expérimentés et un accompagnement personnalisé, du premier semestre jusqu'au diplôme.",
  },
];

export function HomeHero() {
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0); // relance les animations à chaque changement
  const go = (n: number) => {
    setIndex((n + SLIDES.length) % SLIDES.length);
    setCycle((c) => c + 1);
  };
  const slide = SLIDES[index];

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="Présentation de l'université"
      className="group/hero relative isolate flex min-h-[calc(100svh-80px)] items-end overflow-hidden bg-black dark:bg-[#0b1120]"
    >
      {/* Photos superposées : seule la photo active est visible */}
      {SLIDES.map((s, k) => (
        <div key={s.img} aria-hidden className={`absolute inset-0 -z-10 transition-opacity duration-[1400ms] ease-out ${k === index ? "opacity-100" : "opacity-0"}`}>
          <img
            key={k === index ? `actif-${cycle}` : "repos"}
            src={s.img}
            alt=""
            loading={k === 0 ? "eager" : "lazy"}
            className={`h-full w-full object-cover opacity-70 ${UI.photo} ${k === index ? "motion-safe:animate-[hero-zoom_9s_ease-out_both]" : ""}`}
          />
        </div>
      ))}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/40 to-black/20 dark:from-[#0b1120] dark:via-[#0b1120]/50" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/50 to-transparent" />

      <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-32 sm:px-6 lg:px-8">
        {/* Texte de la photo active (réanimé à chaque changement) */}
        <div key={`texte-${cycle}`} className="max-w-4xl" aria-live="polite">
          <p className={`${UI.label} text-neutral-300 dark:text-[#f87171] motion-safe:animate-[hero-rise_0.9s_ease-out_both]`}>{slide.eyebrow}</p>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.04] text-white sm:text-6xl lg:text-7xl motion-safe:animate-[hero-rise_0.9s_0.12s_ease-out_both]" style={serif}>
            {slide.title}
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-neutral-300 motion-safe:animate-[hero-rise_0.9s_0.24s_ease-out_both]">{slide.text}</p>
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <a href="#formations" className="inline-flex items-center gap-2 bg-white px-7 py-3.5 text-sm font-medium tracking-wide text-black transition hover:bg-neutral-200 dark:bg-[#e3262b] dark:text-white dark:hover:bg-[#c81e23]">
            Découvrir nos formations <ArrowRight className="h-4 w-4" />
          </a>
          <a href="/classroom?candidater=1" className="inline-flex items-center gap-2 border border-white/70 px-7 py-3.5 text-sm font-medium tracking-wide text-white transition hover:bg-white hover:text-black">
            Déposer ma candidature
          </a>
        </div>

        {/* Onglets numérotés avec barre de progression, et flèches */}
        <div className="mt-16 flex items-end gap-8 sm:mt-24">
          <div className="grid flex-1 grid-cols-3 gap-4 sm:gap-8">
            {SLIDES.map((s, k) => (
              <button key={s.tab} type="button" onClick={() => go(k)} aria-label={`Photo ${k + 1} : ${s.tab}`} aria-current={k === index}
                className="group text-left">
                <span className="relative block h-px overflow-hidden bg-white/25">
                  {k === index && (
                    <span
                      key={`barre-${cycle}`}
                      onAnimationEnd={() => go(index + 1)}
                      className="absolute inset-0 origin-left bg-white dark:bg-[#e3262b] motion-safe:animate-[hero-progress_7s_linear_both] group-hover/hero:[animation-play-state:paused]"
                    />
                  )}
                </span>
                <span className="mt-4 flex items-baseline gap-3">
                  <span className={`text-sm ${k === index ? "text-white" : "text-neutral-500 group-hover:text-neutral-300"}`} style={serif}>0{k + 1}</span>
                  <span className={`hidden ${UI.label} !text-[10px] transition sm:inline ${k === index ? "text-white" : "text-neutral-500 group-hover:text-neutral-300"}`}>{s.tab}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="hidden gap-2 sm:flex">
            <button type="button" onClick={() => go(index - 1)} aria-label="Photo précédente"
              className="grid h-11 w-11 place-items-center border border-white/30 text-white transition hover:bg-white hover:text-black">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label="Photo suivante"
              className="grid h-11 w-11 place-items-center border border-white/30 text-white transition hover:bg-white hover:text-black">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
