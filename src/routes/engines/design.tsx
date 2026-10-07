import { createFileRoute } from "@tanstack/react-router";
import { DesignEngine } from "@/components/studio/engines/design";

export const Route = createFileRoute("/engines/design")({ component: DesignEnginePage });

function DesignEnginePage() {
  return <DesignEngine />;
}
