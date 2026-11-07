import { useState, useRef } from "react";
import { X, Loader2, Upload, CheckCircle2, Clock, AlertCircle, Copy, Check, Tag } from "lucide-react";
import { toast } from "sonner";
import {
  useMobileMoneySettings, useCreatePayment, useUploadScreenshot, useApplyCoupon,
  type PaymentMethod, type CoursePayment, type CouponPreview,
} from "@/lib/payments";

const API_BASE = "http://localhost:4000";
function mediaUrl(path: string) {
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

const METHOD_CONFIG: Record<PaymentMethod, { label: string; color: string; bg: string }> = {
  MVOLA:        { label: "MVola",        color: "text-red-700",    bg: "bg-red-50 border-red-200" },
  ORANGE_MONEY: { label: "Orange Money", color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  AIRTEL_MONEY: { label: "Airtel Money", color: "text-red-500",    bg: "bg-red-50 border-red-200" },
  CARD:         { label: "Carte bancaire", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
};

interface Props {
  courseId: string;
  courseTitle: string;
  price: number;
  currency?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModal({ courseId, courseTitle, price, currency = "MGA", onClose, onSuccess }: Props) {
  const { data: momo } = useMobileMoneySettings();
  const createPayment = useCreatePayment();
  const uploadScreenshot = useUploadScreenshot();
  const fileRef = useRef<HTMLInputElement>(null);

  const [method, setMethod] = useState<PaymentMethod>("MVOLA");
  const [senderNumber, setSenderNumber] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [remark, setRemark] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState<CoursePayment | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [applied, setApplied] = useState<CouponPreview | null>(null);
  const applyCoupon = useApplyCoupon();

  const effectivePrice = applied ? applied.finalPrice : price;

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    try {
      const preview = await applyCoupon.mutateAsync({ code: couponCode.trim(), courseId });
      setApplied(preview);
      toast.success(`Code appliqué : −${preview.discountAmount.toLocaleString("fr-FR")} ${currency}`);
    } catch (err: unknown) {
      setApplied(null);
      toast.error(err instanceof Error ? err.message : "Code promo invalide");
    }
  }

  // Generate a unique reference for this transaction
  const payRef = `${courseId.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  const momoOptions: { method: PaymentMethod; label: string; numero: string; nom: string }[] = (
    [
      { method: "MVOLA" as const,        label: "MVola",        numero: momo?.mvola.numero ?? "", nom: momo?.mvola.nom ?? "" },
      { method: "ORANGE_MONEY" as const, label: "Orange Money", numero: momo?.orangeMoney.numero ?? "", nom: momo?.orangeMoney.nom ?? "" },
      { method: "AIRTEL_MONEY" as const, label: "Airtel Money", numero: momo?.airtelMoney.numero ?? "", nom: momo?.airtelMoney.nom ?? "" },
    ] as const
  ).filter((o) => o.numero) as { method: PaymentMethod; label: string; numero: string; nom: string }[];

  const selectedMomo = momoOptions.find((o) => o.method === method);
  const cfg = METHOD_CONFIG[method];

  async function handleFileUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await uploadScreenshot.mutateAsync(fd);
      setScreenshotUrl(res.url);
      toast.success("Capture téléchargée");
    } catch {
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  }

  function copyRef() {
    navigator.clipboard.writeText(payRef).then(() => {
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!senderNumber.trim()) { toast.error("Numéro expéditeur requis"); return; }
    if (!transactionRef.trim()) { toast.error("Référence de transaction requise"); return; }

    try {
      const result = await createPayment.mutateAsync({
        courseId, method, senderNumber, transactionRef,
        amount: effectivePrice, currency,
        remark: remark || undefined,
        screenshotUrl: screenshotUrl || undefined,
        couponCode: applied?.code,
      });
      setSubmitted(result);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border bg-card shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-base font-semibold tracking-tight">Paiement du cours</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {submitted ? (
          /* ── SUCCESS STATE ── */
          <div className="px-6 py-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold">Paiement soumis !</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Votre demande de paiement est en attente de validation par l'équipe UR Online.
              Une fois validée, vous serez automatiquement inscrit(e) au cours.
            </p>
            <div className="mt-4 rounded-xl border bg-amber-50 dark:bg-amber-950/20 p-4 text-left">
              <div className="text-xs text-muted-foreground">Référence</div>
              <div className="font-mono text-sm font-bold">{submitted.reference}</div>
            </div>
            <button
              onClick={onClose}
              className="mt-6 inline-flex items-center gap-2 rounded-xl grad-online px-6 py-3 text-sm font-semibold text-white"
            >
              <CheckCircle2 className="h-4 w-4" /> Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="divide-y">

            {/* Course info */}
            <div className="flex items-center gap-3 px-6 py-4 bg-muted/30">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground">Cours</div>
                <div className="truncate font-medium">{courseTitle}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs text-muted-foreground">Prix</div>
                <div className="text-lg font-extrabold text-online">
                  {applied && (
                    <span className="mr-1.5 text-sm font-medium text-muted-foreground line-through">
                      {price.toLocaleString("fr-FR")}
                    </span>
                  )}
                  {effectivePrice.toLocaleString("fr-FR")} {currency}
                </div>
              </div>
            </div>

            {/* Coupon */}
            <div className="px-6 py-4">
              <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                <Tag className="h-4 w-4 text-online" /> Code promo
              </div>
              {applied ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-300/60 bg-emerald-500/10 px-3 py-2 text-sm">
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{applied.code}</span>
                  <span className="text-emerald-700 dark:text-emerald-400">
                    −{applied.discountAmount.toLocaleString("fr-FR")} {currency}
                    {applied.discountType === "PERCENT" && ` (−${applied.discountValue}%)`}
                  </span>
                  <button type="button" onClick={() => { setApplied(null); setCouponCode(""); }}
                    className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Entrez un code"
                    className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={applyCoupon.isPending || !couponCode.trim()}
                    className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
                  >
                    {applyCoupon.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Appliquer"}
                  </button>
                </div>
              )}
            </div>

            {/* Method selection */}
            <div className="px-6 py-5 space-y-3">
              <div className="text-sm font-semibold">Mode de paiement</div>
              <div className="grid gap-2">
                {momoOptions.map((opt) => (
                  <button
                    key={opt.method}
                    type="button"
                    onClick={() => setMethod(opt.method)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors ${
                      method === opt.method
                        ? `${METHOD_CONFIG[opt.method].bg} ${METHOD_CONFIG[opt.method].color} border-current`
                        : "hover:bg-muted/60"
                    }`}
                  >
                    <span className="font-semibold">{opt.label}</span>
                    {method === opt.method && <CheckCircle2 className="h-4 w-4" />}
                  </button>
                ))}
                {momoOptions.length === 0 && (
                  <div className="rounded-xl border border-dashed p-4 text-center text-sm space-y-1">
                    <div className="font-medium text-destructive">Paiement non disponible</div>
                    <div className="text-xs text-muted-foreground">
                      L'administrateur n'a pas encore configuré les numéros de paiement Mobile Money.
                      <br />
                      Contactez l'administrateur pour activer cette fonctionnalité.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payment instructions */}
            {selectedMomo && (
              <div className={`mx-6 my-0 rounded-xl border px-4 py-4 ${cfg.bg} space-y-2`}>
                <div className={`text-sm font-bold ${cfg.color}`}>
                  Effectuez le virement {selectedMomo.label}
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Numéro bénéficiaire</span>
                    <span className="font-mono font-bold">{selectedMomo.numero}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Nom</span>
                    <span className="font-semibold">{selectedMomo.nom || "UR Online"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Montant</span>
                    <span className="font-bold text-online">{effectivePrice.toLocaleString("fr-FR")} {currency}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Référence à mettre</span>
                    <button
                      type="button"
                      onClick={copyRef}
                      className="flex items-center gap-1.5 font-mono font-bold hover:text-online"
                    >
                      {payRef}
                      {copiedRef ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 opacity-50" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Form fields */}
            <div className="px-6 py-5 space-y-4">
              <div className="text-sm font-semibold">Confirmer votre paiement</div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Numéro expéditeur *</label>
                <input
                  value={senderNumber}
                  onChange={(e) => setSenderNumber(e.target.value)}
                  placeholder="034 XX XXX XX"
                  required
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-online/50"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Référence de transaction *</label>
                <input
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="Référence reçue par SMS"
                  required
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-online/50"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Remarque (optionnel)</label>
                <input
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Informations supplémentaires…"
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-online/50"
                />
              </div>

              {/* Screenshot upload */}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Capture d'écran (optionnel)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ""; }}
                />
                {screenshotUrl ? (
                  <div className="relative overflow-hidden rounded-xl border">
                    <img src={mediaUrl(screenshotUrl)} alt="" className="max-h-32 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setScreenshotUrl(null)}
                      className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-sm text-muted-foreground hover:bg-muted/40 disabled:opacity-60"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Upload…" : "Ajouter une capture d'écran"}
                  </button>
                )}
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Votre inscription sera activée <strong>après validation manuelle</strong> par notre équipe,
                  généralement dans les 24h ouvrées.
                </span>
              </div>
            </div>

            {/* Submit */}
            <div className="px-6 py-4">
              <button
                type="submit"
                disabled={createPayment.isPending || momoOptions.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl grad-online py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {createPayment.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Soumettre le paiement
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

export function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    VALIDATED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    REFUSED:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    REFUND_REQUESTED: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    REFUNDED:  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  };
  const labels: Record<string, string> = {
    PENDING: "En attente", VALIDATED: "Validé", REFUSED: "Refusé",
    REFUND_REQUESTED: "Remb. demandé", REFUNDED: "Remboursé",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {labels[status] ?? status}
    </span>
  );
}
