import { createFileRoute } from "@tanstack/react-router";
import { Connection } from "@/components/studio/connection";

export const Route = createFileRoute("/connection")({ component: ConnectionPage });

function ConnectionPage() {
  return <Connection />;
}
