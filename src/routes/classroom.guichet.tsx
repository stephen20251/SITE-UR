import { createFileRoute } from "@tanstack/react-router";
import { useRequireClassroom } from "@/components/classroom/shared";
import { Loading, PageHeader } from "@/components/classroom/cursus-ui";
import { CashDesk } from "@/components/classroom/tuition";

export const Route = createFileRoute("/classroom/guichet")({ component: Guichet });

// Paiement physique de l'écolage au bureau du secrétariat
function Guichet() {
  const { user, ready } = useRequireClassroom(["STAFF", "SUPER_ADMIN"]);
  if (!ready || !user) return <Loading />;
  return (
    <div className="space-y-6">
      <PageHeader title="Guichet écolage" subtitle="Encaissement en espèces au bureau : le reçu est émis et le mois débloqué immédiatement." />
      <CashDesk />
    </div>
  );
}
