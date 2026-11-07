import { Link } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";

export function PublicNav() {
  return (
    <header className="sticky top-0 z-40 glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between container-px">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="grid h-8 w-8 place-items-center rounded-lg grad-hero text-white">
            <GraduationCap className="h-4 w-4" />
          </div>
          University System
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <a href="#programs" className="hover:text-foreground">Programs</a>
          <a href="#about" className="hover:text-foreground">About</a>
          <a href="#contact" className="hover:text-foreground">Contact</a>
        </nav>
        <Link
          to="/choice"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Get started
        </Link>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer id="contact" className="border-t bg-muted/30">
      <div className="mx-auto grid max-w-7xl gap-8 py-12 container-px md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <div className="grid h-8 w-8 place-items-center rounded-lg grad-hero text-white">
              <GraduationCap className="h-4 w-4" />
            </div>
            University System
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Learn online or on campus. One unified experience.
          </p>
        </div>
        {[
          { t: "Platform", l: ["Online courses", "Classroom", "Programs", "Pricing"] },
          { t: "Company", l: ["About", "Careers", "Press", "Contact"] },
          { t: "Legal", l: ["Privacy", "Terms", "Cookies", "Security"] },
        ].map((c) => (
          <div key={c.t}>
            <div className="text-sm font-semibold">{c.t}</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {c.l.map((x) => <li key={x}><a className="hover:text-foreground" href="#">{x}</a></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} University System. All rights reserved.
      </div>
    </footer>
  );
}
