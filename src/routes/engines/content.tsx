import { createFileRoute } from "@tanstack/react-router";
import { ContentEngine } from "@/components/studio/engines/content";

export const Route = createFileRoute("/engines/content")({ component: ContentEnginePage });

function ContentEnginePage() {
  return <ContentEngine />;
}
