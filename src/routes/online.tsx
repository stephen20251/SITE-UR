import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSiteTheme } from "@/components/site-layout";

export const Route = createFileRoute("/online")({
  component: OnlineLayout,
});

// Thème clair / sombre des cours en ligne : même choix que sur le site (bouton du menu).
// La classe est posée sur <html> pour que les fenêtres et notifications suivent aussi.
function OnlineLayout() {
  const { dark } = useSiteTheme();
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    return () => root.classList.remove("dark");
  }, [dark]);
  return <Outlet />;
}
