import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportClientError } from "../lib/error-reporting";
import { AuthProvider } from "../lib/auth";
import { SocketManager } from "../components/socket-manager";
import { Toaster } from "../components/ui/sonner";
import { isThemedPath, THEME_BOOT_SCRIPT, useSiteTheme } from "../components/site-layout";

// Adresse officielle du site (référencement, aperçus de partage)
const SITE_URL = "https://univreference.com";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold tracking-tight">404</h1>
        <p className="mt-4 text-muted-foreground">Cette page n'existe pas.</p>
        <Link to="/" className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportClientError(error, { boundary: "tanstack_root" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >Réessayer</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Université Références — Antananarivo" },
      { name: "description", content: "Université Références (University Reference), Antananarivo : Licence en Informatique et en Gestion, formation en anglais parlé, en présentiel et en ligne." },
      { property: "og:title", content: "Université Références" },
      { property: "og:description", content: "Licence en Informatique et en Gestion, anglais parlé : étudier à Antananarivo ou en ligne." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Université Références" },
      { property: "og:locale", content: "fr_FR" },
      { property: "og:image", content: `${SITE_URL}/images/partage.jpg` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${SITE_URL}/images/partage.jpg` },
      { name: "theme-color", content: "#3b2d8f" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "UR Online" },
    ],
    scripts: [{ children: THEME_BOOT_SCRIPT }],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", type: "image/png", sizes: "96x96", href: "/icons/favicon-96.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192.png" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Service worker (hors connexion) : seulement en production. En développement il
  // servirait d'anciennes versions du code ; on retire celui qui serait déjà installé.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
      caches?.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  // Thème clair / sombre des pages publiques (accueil, actualités, cours en ligne…),
  // posé sur <html> pour que les fenêtres et notifications suivent aussi.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { dark } = useSiteTheme();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark && isThemedPath(pathname));
  }, [dark, pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketManager />
        <Outlet />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
