import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/classroom/documents/$templateId")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/classroom/documents", search: { template: params.templateId } });
  },
  component: () => null,
});
