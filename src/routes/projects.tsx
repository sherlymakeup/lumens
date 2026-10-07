import { createFileRoute } from "@tanstack/react-router";
import { Projects } from "@/components/studio/projects";

export const Route = createFileRoute("/projects")({ component: ProjectsPage });

function ProjectsPage() {
  return <Projects />;
}
