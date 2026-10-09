import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Studio } from "@/components/studio/shell";
import { useStudio } from "@/lib/store";

export const Route = createFileRoute("/thread/$threadId")({ component: Thread });

function Thread() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const hydrated = useStudio((s) => s.hydrated);
  const conversations = useStudio((s) => s.conversations);
  const selectConversation = useStudio((s) => s.selectConversation);

  useEffect(() => {
    if (!hydrated) return;
    const exists = conversations.some((c) => c.id === threadId);
    if (exists) {
      selectConversation(threadId);
    } else {
      // Thread tidak ada di store lokal — kembali ke beranda.
      navigate({ to: "/", replace: true });
    }
  }, [threadId, hydrated, conversations, selectConversation, navigate]);

  return <Studio />;
}
