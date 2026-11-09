// Contenu protégé des cours du cursus universitaire : non téléchargeable,
// non partageable. Côté serveur, les fichiers ne sont servis que par des URL
// signées de courte durée ; côté client on retire tout moyen « officiel » de
// télécharger (bouton, menu contextuel, impression, lecteur PDF natif) et on
// filigrane chaque écran avec l'identité de l'étudiant pour dissuader les
// captures. Aucun navigateur ne permet d'empêcher à 100 % une capture d'écran.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const ProtectedContext = createContext(false);
export const useProtectedContent = () => useContext(ProtectedContext);

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return pdfjsPromise;
}

function Watermark() {
  const { user } = useAuth();
  if (!user) return null;
  const text = `${user.firstName} ${user.lastName} · ${user.email} · ${new Date().toLocaleDateString("fr-FR")}`;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none">
      <div className="absolute -inset-1/2 flex rotate-[-24deg] flex-wrap content-start gap-x-16 gap-y-20 opacity-[0.09]">
        {Array.from({ length: 60 }).map((_, i) => (
          <span key={i} className="whitespace-nowrap text-sm font-semibold text-foreground">{text}</span>
        ))}
      </div>
    </div>
  );
}

export function ProtectedArea({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["s", "p", "u"].includes(k)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  if (!enabled) return <>{children}</>;
  const block = (e: React.SyntheticEvent) => e.preventDefault();
  return (
    <ProtectedContext.Provider value={true}>
      <style>{`@media print { .ur-protected { display: none !important; } }`}</style>
      <div
        className="ur-protected relative select-none"
        onContextMenu={block}
        onCopy={block}
        onCut={block}
        onDragStart={block}
      >
        {children}
        <Watermark />
      </div>
    </ProtectedContext.Provider>
  );
}

export function ProtectedNotice({ canDownload = false }: { canDownload?: boolean }) {
  return (
    <div className="flex items-center gap-2 border-b bg-amber-500/10 px-5 py-2 text-xs text-amber-800 dark:text-amber-300">
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
      {canDownload
        ? "Contenu du cursus universitaire — vidéos en lecture sur la plateforme ; seuls les supports autorisés par l'enseignant se téléchargent. Partage interdit."
        : "Contenu du cursus universitaire — consultation en ligne uniquement (ni téléchargement, ni partage)."}
    </div>
  );
}

// PDF rendu en images (canvas) : pas de lecteur natif, donc pas de bouton
// « Télécharger » ni « Imprimer ».
export function ProtectedPdf({ url, height = 560 }: { url: string; height?: number }) {
  const holder = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [pages, setPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof import("pdfjs-dist").getDocument> | null = null;
    let doc: PDFDocumentProxy | null = null;
    setState("loading");
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        task = pdfjs.getDocument({ url });
        doc = await task.promise;
        if (cancelled || !holder.current) return;
        holder.current.innerHTML = "";
        setPages(doc.numPages);
        const width = holder.current.clientWidth || 800;
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const scale = (width / base.width) * (window.devicePixelRatio || 1);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.floor(viewport.width));
          canvas.height = Math.max(1, Math.floor(viewport.height));
          canvas.style.width = "100%";
          canvas.className = "mb-2 rounded shadow-sm bg-white";
          await page.render({ canvas, viewport }).promise;
          holder.current?.appendChild(canvas);
        }
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => { cancelled = true; task?.destroy(); };
  }, [url]);

  return (
    <div className="relative bg-muted/40" style={{ height }}>
      {state === "loading" && (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {state === "error" && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted-foreground">
          Le document n'a pas pu être affiché. Rouvrez la leçon (le lien de consultation expire après quelques heures).
        </div>
      )}
      <div ref={holder} className="h-full overflow-y-auto p-3" />
      {state === "ready" && pages > 0 && (
        <div className="absolute bottom-2 right-3 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">{pages} page{pages > 1 ? "s" : ""}</div>
      )}
    </div>
  );
}

export function UnviewableDocument({ name }: { name?: string }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 bg-muted/40 px-6 text-center text-sm text-muted-foreground">
      <ShieldCheck className="h-8 w-8 opacity-50" />
      <p>{name ? `« ${name} »` : "Ce document"} ne peut pas être affiché en ligne.</p>
      <p className="text-xs">Les cours du cursus ne sont pas téléchargeables : l'enseignant doit le déposer en PDF, vidéo, audio ou image.</p>
    </div>
  );
}
