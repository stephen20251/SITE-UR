import { createFileRoute, Link } from "@tanstack/react-router";
import { Globe, Building2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/choice")({
  head: () => ({ meta: [{ title: "Choose your system — University" }] }),
  component: Choice,
});

function Choice() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background:radial-gradient(60%_60%_at_30%_20%,oklch(0.58_0.19_260/_.15),transparent),radial-gradient(60%_60%_at_80%_80%,oklch(0.72_0.16_55/_.18),transparent)]" />
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-16">
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to home</Link>
        <h1 className="mt-6 text-center text-4xl font-semibold tracking-tight md:text-6xl">
          How do you want to learn?
        </h1>
        <p className="mt-3 max-w-xl text-center text-muted-foreground">
          Pick the system that fits you. You can always switch later.
        </p>

        <div className="mt-14 grid w-full gap-6 md:grid-cols-2">
          {[
            {
              to: "/online",
              icon: <Globe className="h-7 w-7" />,
              title: "Online System",
              sub: "Learn from anywhere",
              desc: "Coursera-style courses, videos, quizzes, certificates and live chat.",
              grad: "grad-online",
            },
            {
              to: "/classroom",
              icon: <Building2 className="h-7 w-7" />,
              title: "Classroom System",
              sub: "Digitalized campus",
              desc: "Timetables, attendance, grades, finance, announcements — all connected.",
              grad: "grad-classroom",
            },
          ].map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="group relative overflow-hidden rounded-3xl border bg-card p-10 shadow-elegant transition hover:-translate-y-1 hover:shadow-glow"
            >
              <div className={`grid h-14 w-14 place-items-center rounded-2xl ${c.grad} text-white`}>{c.icon}</div>
              <div className="mt-6 text-xs uppercase tracking-wider text-muted-foreground">{c.sub}</div>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">{c.title}</h2>
              <p className="mt-3 max-w-sm text-muted-foreground">{c.desc}</p>
              <div className="mt-8 inline-flex items-center gap-2 text-sm font-medium">
                Continue <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
              <div className={`absolute -bottom-24 -right-24 h-64 w-64 rounded-full opacity-20 blur-3xl ${c.grad}`} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
