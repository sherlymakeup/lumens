import { createFileRoute } from "@tanstack/react-router";
import { CodeEngine } from "@/components/studio/engines/code";

export const Route = createFileRoute("/engines/code")({ component: CodeEnginePage });

function CodeEnginePage() {
  return <CodeEngine />;
}
