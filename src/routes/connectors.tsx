import { createFileRoute } from "@tanstack/react-router";
import { Connectors } from "@/components/studio/connectors";

export const Route = createFileRoute("/connectors")({ component: ConnectorsPage });

function ConnectorsPage() {
  return <Connectors />;
}
