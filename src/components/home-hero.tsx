// Bannière de l'accueil : vidéo du campus en boucle (sans son) et trois messages qui
// se succèdent toutes les SEGMENT secondes, avec des onglets numérotés qui montrent
// la progression. Un clic sur un onglet ou une flèche change de message.
// - Pause (vidéo et messages) quand la souris est sur la bannière.
// - Si le visiteur a demandé à réduire les animations : vidéo arrêtée, pas de défilement.
// Vidéo d'origine : image-UR/video_banneur_home.mp4 (passage de 3,0 s à 29,9 s, réencodé
// en H.264 léger pour le web : campus-video.mp4 en 1280x720 ≈ 2 Mo, campus-video-mobile.mp4
// en 640x360 ≈ 0,9 Mo).
// Chargement : la vidéo n'est téléchargée qu'une fois la page affichée (image d'attente
// avant), et jamais en mode « économie de données » ou sur une connexion très lente.
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { UI, serif } from "@/components/site-layout";

const PHOTO = "/images/accueil";
const SEGMENT = 7; // secondes par message

const SLIDES = [
  {
    tab: "L'université",
    eyebrow: "Université Références · Antananarivo",
    title: <>Apprendre,<br />réussir, s'engager.</>,
    text: "Établissement d'enseignement supérieur, nous formons des étudiants compétents, responsables et innovants, prêts pour le marché du travail national et international.",
  },
  {
    tab: "La pratique",
    eyebrow: "Gestion · Informatique · Anglais",
    title: <>Apprendre<br />en faisant.</>,
    text: "Projets, travaux pratiques et études de cas : des formations concrètes, en présentiel à Antananarivo ou en ligne.",
  },
  {
    tab: "L'accompagnement",
    eyebrow: "Investir le présent, gagner l'avenir",
    title: <>L'exigence au service<br />de votre réussite.</>,
    text: "Des enseignants expérimentés et un accompagnement personnalisé, du premier semestre jusqu'au diplôme.",
  },
];

export function HomeHero() {
  const video = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLSpanElement | null>(null); // barre de l'onglet actif
  const reduced = useRef(false);
  const paused = useRef(false);
  const videoOn = useRef(false); // vidéo autorisée (connexion suffisante, animations permises)
  const elapsed = useRef(0); // temps écoulé (ms) sur le message affiché
  const [index, setIndex] = useState(0);

  // Défilement des messages (indépendant de la vidéo) et barre de progression.
  useEffect(() => {
    const v = video.current;
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Lance la vidéo une fois la page chargée, sauf économie de données ou connexion très lente.
    const startVideo = () => {
      const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      const slow = !!c?.saveData || /(^|-)2g$/.test(c?.effectiveType ?? "");
      if (!v || reduced.current || slow) return; // l'image d'attente reste affichée
      videoOn.current = true;
      v.muted = true; // nécessaire pour la lecture automatique
      if (!paused.current) v.play().catch(() => { /* lecture refusée : l'image d'attente reste */ });
    };
    if (document.readyState === "complete") startVideo();
    else window.addEventListener("load", startVideo, { once: true });
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (!paused.current && !reduced.current) {
        elapsed.current += dt;
        if (elapsed.current >= SEGMENT * 1000) {
          elapsed.current = 0;
          setIndex((k) => (k + 1) % SLIDES.length);
        }
      }
      if (bar.current) bar.current.style.transform = `scaleX(${reduced.current ? 1 : elapsed.current / (SEGMENT * 1000)})`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("load", startVideo); };
  }, []);

  const go = (n: number) => {
    elapsed.current = 0;
    setIndex((n + SLIDES.length) % SLIDES.length);
  };
  const pause = () => { paused.current = true; video.current?.pause(); };
  const resume = () => {
    paused.current = false;
    if (videoOn.current) video.current?.play().catch(() => {});
  };
  const slide = SLIDES[index];

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="Présentation de l'université"
      onMouseEnter={pause}
      onMouseLeave={resume}
      className="relative isolate flex min-h-[calc(100svh-80px)] items-end overflow-hidden bg-[#14204a] dark:bg-[#0b1120]"
    >
      <video
        ref={video}
        muted
        loop
        playsInline
        preload="none"
        poster={`${PHOTO}/campus-video-poster.jpg`}
        aria-hidden
        className={`absolute inset-0 -z-10 h-full w-full object-cover opacity-90 ${UI.photo}`}
      >
        <source src={`${PHOTO}/campus-video-mobile.mp4`} type="video/mp4" media="(max-width: 767px)" />
        <source src={`${PHOTO}/campus-video.mp4`} type="video/mp4" />
      </video>
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0b1430] via-[#0b1430]/30 to-transparent dark:from-[#0b1120] dark:via-[#0b1120]/40" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0b1430]/70 via-[#0b1430]/30 to-transparent" />

      <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-32 sm:px-6 lg:px-8">
        {/* Texte de la photo affichée (réanimé à chaque changement) */}
        <div key={`texte-${index}`} className="max-w-4xl" aria-live="polite">
          <p className={`${UI.label} text-[#fca5a5] motion-safe:animate-[hero-rise_0.9s_ease-out_both]`}>{slide.eyebrow}</p>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.04] text-white sm:text-6xl lg:text-7xl motion-safe:animate-[hero-rise_0.9s_0.12s_ease-out_both]" style={serif}>
            {slide.title}
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-slate-300 motion-safe:animate-[hero-rise_0.9s_0.24s_ease-out_both]">{slide.text}</p>
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <a href="#formations" className="inline-flex items-center gap-2 bg-[#e3262b] px-7 py-3.5 text-sm font-medium tracking-wide text-white shadow-[0_10px_24px_-10px_rgba(227,38,43,0.8)] transition hover:-translate-y-px hover:bg-[#c81e23]">
            Découvrir nos formations <ArrowRight className="h-4 w-4" />
          </a>
          <a href="/classroom?candidater=1" className="inline-flex items-center gap-2 border border-white/70 px-7 py-3.5 text-sm font-medium tracking-wide text-white transition hover:bg-white hover:text-[#14204a]">
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
                    <span ref={bar} className="absolute inset-0 origin-left scale-x-0 bg-[#e3262b]" />
                  )}
                </span>
                <span className="mt-4 flex items-baseline gap-3">
                  <span className={`text-sm ${k === index ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`} style={serif}>0{k + 1}</span>
                  <span className={`hidden ${UI.label} !text-[10px] transition sm:inline ${k === index ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`}>{s.tab}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="hidden gap-2 sm:flex">
            <button type="button" onClick={() => go(index - 1)} aria-label="Photo précédente"
              className="grid h-11 w-11 place-items-center border border-white/30 text-white transition hover:bg-white hover:text-[#14204a]">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label="Photo suivante"
              className="grid h-11 w-11 place-items-center border border-white/30 text-white transition hover:bg-white hover:text-[#14204a]">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
