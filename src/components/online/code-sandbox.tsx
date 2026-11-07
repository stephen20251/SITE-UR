// Client-side code playground for CODE lessons.
// The starter code lives in lesson.body; the student edits and runs it inside
// a sandboxed iframe (allow-scripts only — no same-origin, no network access
// beyond what the browser permits inside srcdoc).
import { useEffect, useMemo, useRef, useState } from "react";
import { Play, RotateCcw, Code2 } from "lucide-react";

export function CodeSandbox({ starter, lessonId }: { starter: string; lessonId: string }) {
  const storageKey = `ur-sandbox-${lessonId}`;
  const [code, setCode] = useState(() => {
    if (typeof window === "undefined") return starter;
    return window.localStorage.getItem(storageKey) ?? starter;
  });
  const [runId, setRunId] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist drafts locally so a reload doesn't lose the student's work.
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { window.localStorage.setItem(storageKey, code); } catch { /* full */ }
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [code, storageKey]);

  // Console piping: capture console.log/error inside the iframe and render below.
  const srcdoc = useMemo(() => {
    if (runId === 0) return "";
    const harness = `
      <script>
        const send = (kind, args) => parent.postMessage({ __sandbox: true, lessonId: ${JSON.stringify(lessonId)}, kind, text: args.map(a => { try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch { return String(a); } }).join(' ') }, '*');
        ['log','info','warn','error'].forEach(k => { const orig = console[k]; console[k] = (...a) => { send(k, a); orig.apply(console, a); }; });
        window.addEventListener('error', (e) => send('error', [e.message]));
      <\/script>`;
    return harness + code;
  }, [runId, code, lessonId]);

  const [logs, setLogs] = useState<{ kind: string; text: string }[]>([]);
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const d = e.data;
      if (d && d.__sandbox && d.lessonId === lessonId) {
        setLogs((prev) => [...prev.slice(-49), { kind: d.kind, text: d.text }]);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [lessonId]);

  function run() {
    setLogs([]);
    setRunId((n) => n + 1);
  }

  function reset() {
    if (!confirm("Revenir au code de départ ? Vos modifications seront perdues.")) return;
    setCode(starter);
    setLogs([]);
    setRunId(0);
    try { window.localStorage.removeItem(storageKey); } catch { /* noop */ }
  }

  return (
    <div className="flex flex-col bg-slate-950 text-white">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Code2 className="h-4 w-4 text-emerald-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Bac à sable — HTML / CSS / JS</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-2.5 py-1.5 text-xs text-white/70 hover:bg-white/10"
          >
            <RotateCcw className="h-3 w-3" /> Réinitialiser
          </button>
          <button
            onClick={run}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400"
          >
            <Play className="h-3 w-3" /> Exécuter
          </button>
        </div>
      </div>

      {/* Editor + preview */}
      <div className="grid md:grid-cols-2" style={{ minHeight: 320 }}>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          className="h-full min-h-[320px] w-full resize-none bg-slate-950 p-3 font-mono text-[13px] leading-relaxed text-emerald-100 outline-none"
        />
        <div className="flex flex-col border-l border-white/10 bg-white">
          {runId > 0 ? (
            <iframe
              key={runId}
              title="sandbox"
              sandbox="allow-scripts"
              srcDoc={srcdoc}
              className="min-h-[220px] flex-1 bg-white"
            />
          ) : (
            <div className="flex min-h-[220px] flex-1 items-center justify-center text-sm text-slate-400">
              Cliquez sur « Exécuter » pour lancer votre code
            </div>
          )}
          {logs.length > 0 && (
            <div className="max-h-28 overflow-y-auto border-t bg-slate-900 p-2 font-mono text-[11px]">
              {logs.map((l, i) => (
                <div key={i} className={l.kind === "error" ? "text-red-400" : l.kind === "warn" ? "text-amber-300" : "text-emerald-200"}>
                  › {l.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
