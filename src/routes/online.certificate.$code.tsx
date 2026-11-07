import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { Loader2, Download, CheckCircle2, AlertCircle, Linkedin, Facebook, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useVerifyCertificate } from "@/lib/online";
import { usePublicSettings } from "@/lib/lms-admin";

// Certificate appearance — admin-customizable via LMS settings (key-value),
// with the historical design as fallback.
export type CertTheme = {
  institution: string; title: string; subtitle: string;
  award: string; complete: string;
  bgFrom: string; bgMid: string; accent: string;
};
export const CERT_DEFAULTS: CertTheme = {
  institution: "Université Régionale — UR Online",
  title: "Excellence",
  subtitle: "Certificat de Réussite",
  award: "décerné à",
  complete: "pour avoir complété avec succès",
  bgFrom: "#0f2044",
  bgMid: "#1a3a6e",
  accent: "#d4af37",
};
export function certThemeFrom(settings: unknown): CertTheme {
  const s = (settings ?? {}) as Record<string, string>;
  return {
    institution: s.certInstitution || CERT_DEFAULTS.institution,
    title: s.certTitle || CERT_DEFAULTS.title,
    subtitle: s.certSubtitle || CERT_DEFAULTS.subtitle,
    award: s.certAwardText || CERT_DEFAULTS.award,
    complete: s.certCompleteText || CERT_DEFAULTS.complete,
    bgFrom: s.certBgFrom || CERT_DEFAULTS.bgFrom,
    bgMid: s.certBgMid || CERT_DEFAULTS.bgMid,
    accent: s.certAccent || CERT_DEFAULTS.accent,
  };
}

export const Route = createFileRoute("/online/certificate/$code")({
  component: CertificatePage,
});

// ─── QR Code (simple SVG-based visual) ───────────────────────────────────────
// Generates a simple visual pattern from the code string (not a real QR code,
// but a deterministic matrix pattern derived from the certificate code).
function QRBlock({ code, color = "#1a3a6e" }: { code: string; color?: string }) {
  const SIZE = 10;
  // Simple hash function to get a deterministic bit matrix from code string
  const bits: boolean[][] = [];
  const hash = code.split("").reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0);
  for (let r = 0; r < SIZE; r++) {
    bits[r] = [];
    for (let c = 0; c < SIZE; c++) {
      const idx = r * SIZE + c;
      const charCode = code.charCodeAt(idx % code.length);
      bits[r][c] = ((charCode ^ (hash + idx * 7)) & 3) !== 0;
    }
  }
  // Mirror for visual symmetry (QR-like)
  for (let r = 0; r < SIZE; r++) {
    for (let c = SIZE - 1; c >= SIZE / 2; c--) {
      bits[r][c] = bits[r][SIZE - 1 - c];
    }
  }
  const cellSize = 5;
  const total = SIZE * cellSize;
  return (
    <svg width={total} height={total} viewBox={`0 0 ${total} ${total}`}>
      <rect width={total} height={total} fill="white" />
      {bits.flatMap((row, r) =>
        row.map((filled, c) =>
          filled ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill={color}
            />
          ) : null
        )
      )}
      {/* Corner markers */}
      {[[0, 0], [0, SIZE - 3], [SIZE - 3, 0]].map(([tr, tc]) => (
        <g key={`m${tr}-${tc}`}>
          <rect x={tc * cellSize} y={tr * cellSize} width={3 * cellSize} height={3 * cellSize} fill="none" stroke={color} strokeWidth={cellSize * 0.6} />
          <rect x={(tc + 1) * cellSize} y={(tr + 1) * cellSize} width={cellSize} height={cellSize} fill={color} />
        </g>
      ))}
    </svg>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

// ─── Social share ─────────────────────────────────────────────────────────────

function ShareButtons({ courseTitle }: { courseTitle: string }) {
  const url = typeof window !== "undefined" ? window.location.href : "";
  const text = `J'ai obtenu mon certificat « ${courseTitle} » sur UR Online ! 🎓`;

  function open(shareUrl: string) {
    window.open(shareUrl, "_blank", "noopener,noreferrer,width=600,height=500");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Lien copié !");
    } catch {
      toast.error("Impossible de copier le lien");
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`)}
        title="Partager sur LinkedIn"
        className="grid h-9 w-9 place-items-center rounded-xl border bg-white text-[#0a66c2] shadow-sm hover:bg-blue-50"
      >
        <Linkedin className="h-4 w-4" />
      </button>
      <button
        onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`)}
        title="Partager sur Facebook"
        className="grid h-9 w-9 place-items-center rounded-xl border bg-white text-[#1877f2] shadow-sm hover:bg-blue-50"
      >
        <Facebook className="h-4 w-4" />
      </button>
      <button
        onClick={() => open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`)}
        title="Partager sur WhatsApp"
        className="grid h-9 w-9 place-items-center rounded-xl border bg-white text-[#25d366] shadow-sm hover:bg-green-50"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </button>
      <button
        onClick={copyLink}
        title="Copier le lien"
        className="grid h-9 w-9 place-items-center rounded-xl border bg-white text-slate-600 shadow-sm hover:bg-slate-50"
      >
        <Link2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function CertificatePage() {
  const { code } = Route.useParams();
  const { data: cert, isLoading, error } = useVerifyCertificate(code);
  const { data: settings } = usePublicSettings();
  const theme = certThemeFrom(settings);
  const certRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    window.print();
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold">Certificat invalide</h1>
        <p className="text-sm text-muted-foreground">
          Ce code de certificat est introuvable ou invalide.
        </p>
        <code className="rounded-lg border bg-muted px-4 py-2 font-mono text-sm">{code}</code>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Print controls — hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Certificat vérifié — <span className="font-mono font-bold text-foreground">{cert.code}</span>
          </div>
          <div className="flex items-center gap-2">
            <ShareButtons courseTitle={cert.courseTitle} />
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow hover:opacity-90"
            >
              <Download className="h-4 w-4" /> Télécharger / Imprimer
            </button>
          </div>
        </div>
      </div>

      {/* Certificate document */}
      <div className="mx-auto max-w-4xl p-6 print:p-0">
        <div
          ref={certRef}
          className="relative overflow-hidden rounded-2xl print:rounded-none"
          style={{
            background: `linear-gradient(135deg, ${theme.bgFrom} 0%, ${theme.bgMid} 30%, ${theme.bgFrom} 60%, #1e1008 100%)`,
            minHeight: "600px",
            aspectRatio: "1.414 / 1",
          }}
        >
          {/* Gold border */}
          <div
            className="absolute inset-2 rounded-xl"
            style={{ border: `2px solid ${theme.accent}99` }}
          />
          <div
            className="absolute inset-3 rounded-xl"
            style={{ border: `1px solid ${theme.accent}4d` }}
          />

          {/* Watermark */}
          <div
            className="absolute inset-0 flex items-center justify-center opacity-5 select-none pointer-events-none"
            style={{ transform: "rotate(-30deg)" }}
          >
            <div className="text-center text-white">
              <div className="text-8xl font-black tracking-widest">UR</div>
              <div className="text-4xl font-bold tracking-wider">ONLINE</div>
            </div>
          </div>

          {/* Gold ornamental stars */}
          <div className="absolute top-6 left-6 text-2xl opacity-60 text-yellow-400">✦</div>
          <div className="absolute top-6 right-6 text-2xl opacity-60 text-yellow-400">✦</div>
          <div className="absolute bottom-6 left-6 text-2xl opacity-60 text-yellow-400">✦</div>
          <div className="absolute bottom-6 right-6 text-2xl opacity-60 text-yellow-400">✦</div>

          {/* Main content */}
          <div className="relative z-10 flex h-full flex-col items-center justify-between px-12 py-10 print:px-16 print:py-12">

            {/* Header */}
            <div className="text-center">
              <div
                className="mx-auto mb-2 inline-flex h-14 w-14 items-center justify-center rounded-full text-2xl"
                style={{ background: `linear-gradient(135deg, ${theme.accent}, #f5d776, #b8962e)`, boxShadow: `0 0 20px ${theme.accent}66` }}
              >
                🏅
              </div>
              <div
                className="text-xs font-bold uppercase tracking-[0.3em]"
                style={{ color: theme.accent }}
              >
                {theme.institution}
              </div>
            </div>

            {/* Certificate title */}
            <div className="text-center space-y-1">
              <div className="text-white/70 text-sm font-light tracking-widest uppercase">{theme.subtitle}</div>
              <div
                className="text-5xl font-bold text-white leading-tight"
                style={{ fontFamily: "Georgia, serif", textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}
              >
                {theme.title}
              </div>
              <div className="flex items-center justify-center gap-3 mt-1">
                <div className="h-px w-12 bg-yellow-400/60" />
                <div className="text-yellow-400 text-base">✦</div>
                <div className="h-px w-12 bg-yellow-400/60" />
              </div>
            </div>

            {/* Student name */}
            <div className="text-center space-y-2">
              <div className="text-white/60 text-sm tracking-widest uppercase">{theme.award}</div>
              <div
                className="text-3xl font-bold text-white"
                style={{ fontFamily: "Georgia, serif", textShadow: "0 2px 4px rgba(0,0,0,0.4)" }}
              >
                {cert.studentName}
              </div>
              <div className="text-white/50 text-sm">{cert.studentEmail}</div>
            </div>

            {/* Course name */}
            <div className="text-center space-y-1 max-w-lg">
              <div className="text-white/60 text-sm tracking-widest uppercase">{theme.complete}</div>
              <div
                className="text-xl font-semibold text-white leading-snug"
                style={{ color: theme.accent }}
              >
                {cert.courseTitle}
              </div>
              <div className="text-white/50 text-sm">Progression : {cert.progress}%</div>
            </div>

            {/* Footer: date + signature + QR */}
            <div className="flex w-full items-end justify-between mt-2">
              {/* Date */}
              <div className="text-center">
                <div className="h-px w-24 bg-yellow-400/40 mb-2" />
                <div className="text-white/70 text-xs">{fmtDate(cert.issuedAt)}</div>
                <div className="text-white/40 text-xs mt-0.5">Date de délivrance</div>
              </div>

              {/* Seal */}
              <div
                className="flex h-16 w-16 flex-col items-center justify-center rounded-full text-center"
                style={{
                  background: `linear-gradient(135deg, ${theme.accent}, #f5d776, #b8962e)`,
                  boxShadow: `0 0 15px ${theme.accent}80, inset 0 1px 2px rgba(255,255,255,0.3)`,
                }}
              >
                <div className="text-[10px] font-black text-yellow-900 leading-none uppercase">UR</div>
                <div className="text-[7px] font-bold text-yellow-900/80 mt-0.5 uppercase tracking-tight">Certified</div>
              </div>

              {/* QR Code + cert ID */}
              <div className="text-center">
                <div className="rounded-lg overflow-hidden bg-white p-1.5 mx-auto w-fit mb-1">
                  <QRBlock code={cert.code} color={theme.bgMid} />
                </div>
                <div className="text-white/40 text-[9px] font-mono">{cert.code}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Verification info — below the certificate, hidden when printing */}
        <div className="print:hidden mt-6 rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-500 shrink-0" />
            <div>
              <div className="font-semibold text-sm">Certificat authentique</div>
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <div>Cours : <span className="font-medium text-foreground">{cert.courseTitle}</span></div>
                <div>Étudiant : <span className="font-medium text-foreground">{cert.studentName}</span></div>
                <div>Délivré le : <span className="font-medium text-foreground">{fmtDate(cert.issuedAt)}</span></div>
                <div>ID : <span className="font-mono font-bold text-foreground">{cert.code}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
