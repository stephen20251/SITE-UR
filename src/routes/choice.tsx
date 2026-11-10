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

// Choix de l'espace : deux grandes cartes photo, couleurs de l'université
// (bleu nuit et rouge), même thème clair / sombre que l'accueil.
const SPACES = [
  { to: "/classroom", Icon: Building2, title: "Espace université", photo: "/images/accueil/banniere-cours.jpg", tint: "from-[#14204a]/90 via-[#14204a]/45" },
  { to: "/online", Icon: MonitorPlay, title: "Cours en ligne", photo: "/images/accueil/online-cadre.jpg", tint: "from-[#3b1d6e]/90 via-[#3b1d6e]/40" },
] as const;

function Choice() {
  const { dark } = useSiteTheme();
  return (
    <div className={dark ? "dark" : ""}>
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#f3f6fd] to-white text-[#14204a] antialiased dark:from-[#0b1120] dark:to-[#0b1120] dark:text-white">
        {/* halos de couleur discrets */}
        <div className="pointer-events-none absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-[#e3262b]/10 blur-3xl dark:bg-[#e3262b]/15" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-[460px] w-[460px] rounded-full bg-[#14204a]/10 blur-3xl dark:bg-indigo-500/10" />

        <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-4 py-16 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500 transition hover:text-[#e3262b] dark:text-slate-400 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Retour à l'accueil
          </Link>
          <div className="mt-10"><LogoMark className="h-20" /></div>
          <h1 className="mt-6 text-center text-4xl font-semibold tracking-tight sm:text-5xl" style={serif}>
            Espace numérique
          </h1>
          <span className="mt-5 block h-0.5 w-14 bg-[#e3262b]" />

          <div className="mt-12 grid w-full gap-6 md:grid-cols-2">
            {SPACES.map(({ to, Icon, title, photo, tint }) => (
              <Link
                key={to}
                to={to}
                className="group relative isolate flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-3xl p-8 shadow-[0_30px_60px_-30px_rgba(20,32,74,0.55)] ring-1 ring-black/5 transition duration-500 hover:-translate-y-1 hover:shadow-[0_40px_70px_-30px_rgba(227,38,43,0.45)] dark:ring-white/10 sm:p-10"
              >
                <img src={photo} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <div className={`absolute inset-0 -z-10 bg-gradient-to-t ${tint} to-transparent`} />
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 text-white ring-1 ring-white/25 backdrop-blur transition group-hover:bg-[#e3262b] group-hover:ring-[#e3262b]">
                  <Icon className="h-7 w-7" strokeWidth={1.5} />
                </span>
                <span className="mt-5 flex items-center justify-between gap-4">
                  <span className="text-3xl font-semibold text-white" style={serif}>{title}</span>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e3262b] text-white transition group-hover:translate-x-1">
                    <ArrowRight className="h-5 w-5" />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
