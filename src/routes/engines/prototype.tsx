import { createFileRoute } from "@tanstack/react-router";
import { PrototypeEngine } from "@/components/studio/engines/prototype";

export const Route = createFileRoute("/engines/prototype")({ component: PrototypeEnginePage });

function PrototypeEnginePage() {
  return <PrototypeEngine />;
}
