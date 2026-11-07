import { createFileRoute } from "@tanstack/react-router";
import { Loader2, CreditCard, FileText, BarChart3, Wallet } from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";

export const Route = createFileRoute("/classroom/comptabilite")({ component: ComptabiliteDash });

function ComptabiliteDash() {
  const { user, roles, ready } = useRequireClassroom(["STAFF"]);

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{roles[0]?.roleName ?? "Comptabilité"}</h1>
        <p className="text-muted-foreground">Suivi des paiements, factures et rapports financiers.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Paiements reçus",    value: "—", icon: <CreditCard className="h-5 w-5 text-classroom" /> },
          { label: "Factures en attente",value: "—", icon: <FileText className="h-5 w-5 text-classroom" /> },
          { label: "Revenu mensuel",     value: "—", icon: <Wallet className="h-5 w-5 text-classroom" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-elegant">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-classroom/10">{icon}</div>
            <div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-card p-8 text-center shadow-elegant">
        <BarChart3 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="font-medium text-muted-foreground">Module Comptabilité</p>
        <p className="mt-1 text-sm text-muted-foreground/70">Gestion financière complète — disponible dans la prochaine phase.</p>
      </div>
    </div>
  );
}
