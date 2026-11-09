// Erreur d'affichage attrapée par la page d'erreur : écrite dans la console du navigateur.
export function reportClientError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[UR] erreur d'affichage", { route: window.location.pathname, ...context }, error);
}
