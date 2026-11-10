import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Building2, MonitorPlay } from "lucide-react";
import { LogoMark, SITE_FONTS, serif, useSiteTheme } from "@/components/site-layout";

export const Route = createFileRoute("/choice")({
  head: () => ({
    meta: [{ title: "Espace numérique — Université Références" }],
    links: [{ rel: "stylesheet", href: SITE_FONTS }],
  }),
  component: Choice,
});

// Choix de l'espace : même thème que l'accueil (clair noir et blanc, ou sombre bleu nuit et rouge).
const SPACES = [
  { to: "/classroom", Icon: Building2, title: "Espace université" },
  { to: "/online", Icon: MonitorPlay, title: "Cours en ligne" },
] as const;

function Choice() {
  const { dark } = useSiteTheme();
  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-white text-black antialiased dark:bg-[#0b1120] dark:text-white">
        <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-4 py-16 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em] text-neutral-500 transition hover:text-black dark:text-slate-400 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Retour à l'accueil
          </Link>
          <div className="mt-10"><LogoMark className="h-20" /></div>
          <h1 className="mt-8 text-center text-4xl font-semibold tracking-tight sm:text-5xl" style={serif}>
            Espace numérique
          </h1>

          <div className="mt-14 grid w-full gap-px bg-neutral-200 dark:bg-white/10 md:grid-cols-2">
            {SPACES.map(({ to, Icon, title }) => (
              <Link
                key={to}
                to={to}
                className="group flex items-center justify-between gap-6 bg-white p-8 transition hover:bg-neutral-50 dark:bg-[#162036] dark:hover:bg-[#1c2944] sm:p-10"
              >
                <span className="flex items-center gap-5">
                  <Icon className="h-7 w-7 shrink-0 text-black dark:text-[#f87171]" strokeWidth={1.5} />
                  <span className="text-2xl font-semibold" style={serif}>{title}</span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-1 dark:text-[#f87171]" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
