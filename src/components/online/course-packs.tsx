// Packs contenant un cours (ex. Java I + II + III) — tarif fixé par le Super Admin,
// inférieur à la somme des cours achetés un par un.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Package, Tag, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { pqk, useMobileMoneySettings } from "@/lib/payments";

type Pack = {
  id: string; title: string; description: string | null; price: number; currency: string;
  individualTotal: number; saving: number;
  courses: { courseId: string; course: { id: string; title: string; price: number | null } }[];
};

const fmt = (n: number, cur = "MGA") => `${Math.round(n).toLocaleString("fr-FR")} ${cur}`;
const METHODS = [
  { v: "MVOLA", l: "MVola", key: "mvola" },
  { v: "ORANGE_MONEY", l: "Orange Money", key: "orangeMoney" },
  { v: "AIRTEL_MONEY", l: "Airtel Money", key: "airtelMoney" },
] as const;

export function CoursePacks({ courseId }: { courseId: string }) {
  const packs = useQuery({
    queryKey: ["online", "packs", courseId],
    queryFn: () => api<Pack[]>(`/online/pricing/packs?courseId=${courseId}`),
  });
  const [buying, setBuying] = useState<Pack | null>(null);
  if (!packs.data?.length) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Disponible aussi en pack</p>
      {packs.data.map((p) => (
        <div key={p.id} className="rounded-xl border border-online/30 bg-online/5 p-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-online" />
            <span className="flex-1 text-sm font-semibold">{p.title}</span>
          </div>
          <ul className="mt-1 text-xs text-muted-foreground">
            {p.courses.map((c) => <li key={c.courseId}>• {c.course.title}</li>)}
          </ul>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-base font-extrabold text-online">{fmt(p.price, p.currency)}</span>
            {p.saving > 0 && (
              <>
                <span className="text-xs text-muted-foreground line-through">{fmt(p.individualTotal, p.currency)}</span>
                <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-600"><Tag className="h-3 w-3" /> −{fmt(p.saving, p.currency)}</span>
              </>
            )}
            <button onClick={() => setBuying(p)} className="ml-auto rounded-lg grad-online px-3 py-1.5 text-xs font-bold text-white">Acheter le pack</button>
          </div>
        </div>
      ))}
      {buying && <BuyPackModal pack={buying} onClose={() => setBuying(null)} />}
    </div>
  );
}

function BuyPackModal({ pack, onClose }: { pack: Pack; onClose: () => void }) {
  const qc = useQueryClient();
  const settings = useMobileMoneySettings();
  const [method, setMethod] = useState<(typeof METHODS)[number]["v"]>("MVOLA");
  const [senderNumber, setSender] = useState("");
  const [transactionRef, setRef] = useState("");
  const buy = useMutation({
    mutationFn: () => api(`/online/pricing/packs/${pack.id}/purchase`, { method: "POST", body: { method, senderNumber, transactionRef } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pqk.mine() });
      qc.invalidateQueries({ queryKey: ["online"] });
      toast.success("Paiement du pack envoyé : accès immédiat, validation par l'administration.");
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Achat impossible"),
  });
  const m = METHODS.find((x) => x.v === method)!;
  const dest = settings.data?.[m.key];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <form onSubmit={(e) => { e.preventDefault(); buy.mutate(); }} className="w-full max-w-md space-y-4 rounded-2xl bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{pack.title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="rounded-xl bg-online/5 p-3 text-sm">
          Montant à envoyer : <b>{fmt(pack.price, pack.currency)}</b> pour {pack.courses.length} cours
          {dest?.numero && <p className="mt-1 text-xs text-muted-foreground">Destinataire {m.l} : <b>{dest.numero}</b>{dest.nom ? ` (${dest.nom})` : ""}</p>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {METHODS.map((x) => (
            <button key={x.v} type="button" onClick={() => setMethod(x.v)}
              className={`rounded-lg border px-2 py-2 text-xs font-medium ${method === x.v ? "border-online bg-online/10 text-online" : "hover:bg-accent"}`}>{x.l}</button>
          ))}
        </div>
        <input required value={senderNumber} onChange={(e) => setSender(e.target.value)} placeholder="Votre numéro (expéditeur)"
          className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none" />
        <input required value={transactionRef} onChange={(e) => setRef(e.target.value)} placeholder="Référence de la transaction"
          className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none" />
        <button type="submit" disabled={buy.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl grad-online py-3 text-sm font-bold text-white disabled:opacity-60">
          {buy.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Confirmer l'achat du pack
        </button>
      </form>
    </div>
  );
}
