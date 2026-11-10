// Fenêtre de détail d'une mention, ouverte depuis la section « Nos mentions » de l'accueil.
// Elle glisse depuis la droite et se ferme par la croix, la touche Échap ou un clic
// à côté. Tout son contenu vient de l'administration (Configuration → Structure →
// Mentions → Modifier) ; les parcours et le programme viennent du plan de cursus.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, ChevronDown, Loader2, UserPlus, X } from "lucide-react";
import { api } from "@/lib/api";
import { mediaUrl } from "@/components/online/mooc-card";
import { UI, serif } from "@/components/site-layout";

export type MentionDetail = {
  id: string; name: string; code: string; level: string | null; duration: number | null;
  description: string | null; tagline: string | null; imageUrl: string | null;
  diploma: string | null; studyModes: string | null; admission: string | null;
  objectives: string[]; skills: string[]; careers: string[];
  domain: { name: string; code: string } | null;
  parcours: { id: string; name: string; description: string | null }[];
  program: { level: string; semesters: { semester: number; courses: string[] }[] }[];
};

const LEVEL_LABEL: Record<string, string> = { L1: "Première année", L2: "Deuxième année", L3: "Troisième année", M1: "Master 1", M2: "Master 2" };
const paragraphs = (s?: string | null) => (s ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className={`border-t pt-10 ${UI.border}`}>
      <p className={`${UI.label} ${UI.eyebrow}`}>{n}</p>
      <h3 className={`mt-3 text-2xl font-semibold sm:text-3xl ${UI.title}`} style={serif}>{title}</h3>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function MentionPanel({ mentionId, fallbackImage, onClose }: { mentionId: string; fallbackImage: string; onClose: () => void }) {
  const [closing, setClosing] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const { data: m, isLoading, isError } = useQuery({
    queryKey: ["public", "mention", mentionId],
    queryFn: () => api<MentionDetail>(`/online/public/mentions/${mentionId}`, { auth: false }),
    staleTime: 60_000,
  });

  const close = () => {
    if (closing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return onClose();
    setClosing(true);
    setTimeout(onClose, 320);
  };

  // Échap pour fermer ; page bloquée derrière la fenêtre ; focus sur la croix.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const img = m?.imageUrl ? mediaUrl(m.imageUrl) : fallbackImage;
  const facts = m ? [
    m.level && { k: "Niveau", v: m.level },
    m.duration && { k: "Durée", v: `${m.duration} an${m.duration > 1 ? "s" : ""}` },
    m.diploma && { k: "Diplôme", v: m.diploma },
    m.studyModes && { k: "Modalités", v: m.studyModes },
  ].filter(Boolean) as { k: string; v: string }[] : [];
  const hasContent = m && (m.description || m.objectives.length || m.skills.length || m.careers.length || m.admission || m.parcours.length || m.program.length);
  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="mention-title">
      {/* Voile : un clic à côté ferme la fenêtre */}
      <div onClick={close}
        className={`absolute inset-0 bg-[#14204a]/60 backdrop-blur-[3px] ${closing ? "motion-safe:animate-[veil-out_0.32s_ease-in_both]" : "motion-safe:animate-[veil-in_0.4s_ease-out_both]"}`} />

      <aside className={`absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-[#0b1120] ${closing ? "motion-safe:animate-[panel-out_0.32s_cubic-bezier(0.4,0,1,1)_both]" : "motion-safe:animate-[panel-in_0.55s_cubic-bezier(0.16,1,0.3,1)_both]"}`}>
        <button ref={closeBtn} onClick={close} aria-label="Fermer"
          className="absolute right-4 top-4 z-20 grid h-11 w-11 place-items-center bg-white/90 text-[#14204a] backdrop-blur transition hover:bg-white dark:bg-[#0b1120]/80 dark:text-white dark:hover:bg-[#0b1120]">
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* En-tête : photo, domaine, nom, accroche */}
          <div className="relative aspect-[4/3] overflow-hidden bg-[#14204a] sm:aspect-[16/10]">
            <img src={img} alt="" className={`h-full w-full object-cover opacity-80 ${UI.photo}`} />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b1430] via-[#0b1430]/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-8 sm:p-10">
              <p className={`${UI.label} text-slate-300 dark:text-[#f87171]`}>{m?.domain?.name ?? "Mention"}</p>
              <h2 id="mention-title" className="mt-3 text-4xl font-semibold leading-[1.05] text-white sm:text-6xl" style={serif}>
                {m?.name ?? " "}
              </h2>
              {m?.tagline && <p className="mt-4 max-w-lg text-lg leading-relaxed text-slate-200">{m.tagline}</p>}
            </div>
          </div>

          {isLoading && <div className="grid h-48 place-items-center"><Loader2 className={`h-6 w-6 animate-spin ${UI.muted}`} aria-label="Chargement" /></div>}
          {isError && <p className={`p-10 text-center ${UI.text}`}>La présentation de cette mention n'a pas pu être chargée.</p>}

          {m && (
            <div className="px-8 pb-12 sm:px-10">
              {/* Chiffres clés de la mention */}
              {facts.length > 0 && (
                <dl className={`grid grid-cols-2 border-b ${UI.border} ${facts.length > 2 ? "sm:grid-cols-4" : ""}`}>
                  {facts.map((f) => (
                    <div key={f.k} className={`border-r py-6 pr-4 last:border-r-0 ${UI.border} [&:nth-child(2)]:max-sm:border-r-0`}>
                      <dt className={`${UI.label} !text-[10px] ${UI.muted}`}>{f.k}</dt>
                      <dd className={`mt-2 text-lg font-semibold leading-snug ${UI.title}`} style={serif}>{f.v}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <div className="mt-10 space-y-12">
                {!hasContent && (
                  <p className={`border-t pt-10 ${UI.border} ${UI.text}`}>La présentation détaillée de cette mention sera bientôt disponible.</p>
                )}

                {m.description && (
                  <Section n={num()} title="Présentation">
                    <div className={`space-y-4 text-base leading-relaxed ${UI.text}`}>
                      {paragraphs(m.description).map((p, i) => <p key={i}>{p}</p>)}
                    </div>
                  </Section>
                )}

                {m.objectives.length > 0 && (
                  <Section n={num()} title="Objectifs de la formation">
                    <ol className={`divide-y ${UI.border} dark:divide-white/10`}>
                      {m.objectives.map((o, i) => (
                        <li key={i} className="flex gap-5 py-4">
                          <span className={`w-6 shrink-0 text-sm ${UI.eyebrow}`} style={serif}>{i + 1}</span>
                          <span className={`leading-relaxed ${UI.text}`}>{o}</span>
                        </li>
                      ))}
                    </ol>
                  </Section>
                )}

                {m.skills.length > 0 && (
                  <Section n={num()} title="Compétences acquises">
                    <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                      {m.skills.map((s, i) => (
                        <li key={i} className={`flex items-start gap-3 leading-relaxed ${UI.text}`}>
                          <Check className="mt-1 h-4 w-4 shrink-0 text-[#14204a] dark:text-[#f87171]" strokeWidth={2} /> {s}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {m.parcours.length > 0 && (
                  <Section n={num()} title="Parcours proposés">
                    <div className="grid gap-px bg-slate-200 dark:bg-white/10 sm:grid-cols-2">
                      {m.parcours.map((p) => (
                        <div key={p.id} className="bg-white p-6 dark:bg-[#0b1120]">
                          <p className={`text-lg font-semibold ${UI.title}`} style={serif}>{p.name}</p>
                          {p.description && <p className={`mt-2 text-sm leading-relaxed ${UI.text}`}>{p.description}</p>}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {m.program.length > 0 && (
                  <Section n={num()} title="Programme">
                    <div className={`divide-y border-y ${UI.border} dark:divide-white/10`}>
                      {m.program.map((y, i) => (
                        <details key={y.level} open={i === 0} className="group/year">
                          <summary className="flex cursor-pointer list-none items-center justify-between py-5 [&::-webkit-details-marker]:hidden">
                            <span className="flex items-baseline gap-4">
                              <span className={`${UI.label} !text-[10px] ${UI.eyebrow}`}>{y.level}</span>
                              <span className={`text-lg font-semibold ${UI.title}`} style={serif}>{LEVEL_LABEL[y.level] ?? y.level}</span>
                            </span>
                            <ChevronDown className={`h-5 w-5 transition-transform group-open/year:rotate-180 ${UI.muted}`} strokeWidth={1.5} />
                          </summary>
                          <div className="grid gap-6 pb-6 sm:grid-cols-2">
                            {y.semesters.map((s) => (
                              <div key={s.semester}>
                                <p className={`${UI.label} !text-[10px] ${UI.muted}`}>Semestre {s.semester}</p>
                                <ul className={`mt-3 space-y-2 text-sm leading-relaxed ${UI.text}`}>
                                  {s.courses.map((c) => <li key={c}>{c}</li>)}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  </Section>
                )}

                {m.careers.length > 0 && (
                  <Section n={num()} title="Débouchés">
                    <ul className="flex flex-wrap gap-2">
                      {m.careers.map((c, i) => (
                        <li key={i} className={`border border-slate-300 px-4 py-2 text-sm dark:border-white/20 ${UI.title}`}>{c}</li>
                      ))}
                    </ul>
                  </Section>
                )}

                {m.admission && (
                  <Section n={num()} title="Admission">
                    <div className={`space-y-4 leading-relaxed ${UI.text}`}>
                      {paragraphs(m.admission).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
                    </div>
                  </Section>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions, toujours visibles */}
        <div className={`flex flex-wrap gap-3 border-t bg-white px-8 py-5 dark:bg-[#0b1120] sm:px-10 ${UI.border}`}>
          <a href="/classroom?candidater=1" className={`flex-1 ${UI.btnDark}`}><UserPlus className="h-4 w-4" /> Déposer ma candidature</a>
          <a href="#adresse" className={`flex-1 ${UI.btnLine}`}
            onClick={(e) => { e.preventDefault(); close(); setTimeout(() => document.getElementById("adresse")?.scrollIntoView({ behavior: "smooth" }), 360); }}>
            Nous contacter <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </aside>
    </div>
  );
}
