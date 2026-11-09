// Adresse du serveur de l'API, fixée au moment du build par VITE_API_URL.
//   Local      : rien à définir → http://localhost:4000
//   Production : VITE_API_URL=https://api.votre-domaine.com (sans « /api » à la fin)
const raw = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").trim().replace(/\/+$/, "");

// Origine du serveur : fichiers déposés (/uploads/…), Socket.io, liens signés.
export const API_ORIGIN = (raw || "http://localhost:4000").replace(/\/api$/, "");
// Racine des routes de l'API.
export const API_URL = `${API_ORIGIN}/api`;
