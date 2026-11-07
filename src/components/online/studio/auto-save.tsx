import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function useAutoSave<T>(
  value: T,
  saveFn: (val: T) => Promise<void>,
  delayMs = 12_000,
) {
  const [state, setState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValue = useRef(value);
  const isFirstRender = useRef(true);

  latestValue.current = value;

  // flush() : sauvegarde automatique silencieuse.
  // flush(évènement de clic) : bouton « Sauvegarder maintenant » → message de confirmation / d'erreur.
  const flush = useCallback(async (manual?: unknown) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setState("saving");
    try {
      await saveFn(latestValue.current);
      setState("saved");
      if (manual) toast.success("Modifications enregistrées");
      setTimeout(() => setState("idle"), 3000);
    } catch (e) {
      setState("error");
      if (manual) toast.error(e instanceof Error && e.message ? e.message : "L'enregistrement a échoué");
    }
  }, [saveFn]);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setState("idle");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { flush(); }, delayMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value, delayMs, flush]);

  return { state, flush };
}

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const map = {
    saving: { text: "Enregistrement…", cls: "text-muted-foreground" },
    saved:  { text: "✓ Enregistré",    cls: "text-green-600" },
    error:  { text: "⚠ Erreur de synchronisation", cls: "text-destructive" },
  } as const;
  const { text, cls } = map[state];
  return <span className={`text-xs ${cls}`}>{text}</span>;
}
