import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/erp/planning")({
  component: () => <Outlet />,
});
