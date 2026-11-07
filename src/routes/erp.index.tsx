import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useErpAuth } from "./erp";
import { dashboardPath } from "../lib/erp";

export const Route = createFileRoute("/erp/")({
  component: ErpIndex,
});

function ErpIndex() {
  const navigate = useNavigate();
  const { user, roles, ready } = useErpAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) { navigate({ to: "/erp/login" }); return; }
    const roleName = roles[0]?.roleName ?? "";
    navigate({ to: dashboardPath(user.systemRole, roleName) as any, replace: true });
  }, [ready, user, roles]);

  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0F1E3C] border-t-[#FFD166]" />
    </div>
  );
}
