// Build du site (TanStack Start). En production, Nitro produit un serveur Node.js
// autonome dans .output/ : on le lance avec « npm start » (node .output/server/index.mjs).
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ command }) => ({
  server: { host: "::", port: 8080 },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Entrée serveur : src/server.ts (page d'erreur propre si le rendu échoue)
      server: { entry: "server" },
      // Le code « serveur » ne doit jamais partir dans le navigateur.
      importProtection: { behavior: "error", client: { files: ["**/server/**"], specifiers: ["server-only"] } },
    }),
    ...(command === "build"
      ? [nitro({
          preset: "node-server",
          // Photos, vidéos et icônes gardées 7 jours par le navigateur (pas retéléchargées à
          // chaque visite). Pour remplacer un fichier tout de suite, changez son nom.
          routeRules: {
            "/images/**": { headers: { "cache-control": "public, max-age=604800" } },
            "/icons/**": { headers: { "cache-control": "public, max-age=604800" } },
            "/logo-ur-embleme.png": { headers: { "cache-control": "public, max-age=604800" } },
            "/logo-ur-embleme-blanc.png": { headers: { "cache-control": "public, max-age=604800" } },
            "/favicon.ico": { headers: { "cache-control": "public, max-age=604800" } },
          },
        })]
      : []),
    viteReact(),
  ],
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
