import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Studio } from "@/components/studio/shell";
import { useStudio } from "@/lib/store";

export const Route = createFileRoute("/thread/$threadId")({ component: Thread });

function Thread() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const hydrated = useStudio((s) => s.hydrated);
  const syncLoaded = useStudio((s) => s.syncLoaded);
  const conversations = useStudio((s) => s.conversations);
  const selectConversation = useStudio((s) => s.selectConversation);
  // Cegah redirect berulang jika thread memang tidak ada.
  const redirectedRef = useRef(false);

  useEffect(() => {
    // Tunggu sync Supabase selesai — jangan redirect prematur saat data
    // masih dimuat (penyebab loop navigasi = hang).
    if (!hydrated || !syncLoaded) return;
    const exists = conversations.some((c) => c.id === threadId);
    if (exists) {
      redirectedRef.current = false;
      selectConversation(threadId);
    } else if (!redirectedRef.current) {
      // Thread tidak ada SETELAH sync selesai — clear activeId dulu agar
      // effect URL-sync di shell tidak navigasi balik ke thread ini (loop).
      redirectedRef.current = true;
      useStudio.setState({ activeId: null });
      navigate({ to: "/", replace: true });
    }
  }, [threadId, hydrated, syncLoaded, conversations, selectConversation, navigate]);

  return <Studio />;
}
