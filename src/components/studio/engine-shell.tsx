import type { ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useStudio } from "@/lib/store";
import { Sidebar } from "./sidebar";

export function EngineShell({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const sidebarOpen = useStudio((s) => s.sidebarOpen);
  const setSidebarOpen = useStudio((s) => s.setSidebarOpen);
  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <aside className="hidden h-dvh w-64 shrink-0 border-r border-sidebar-border md:block">
        <Sidebar />
      </aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" title="Menus" className="p-0 max-w-72">
          <Sidebar />
        </SheetContent>
      </Sheet>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            {kicker}
          </p>
          <h1 className="font-display mt-2 text-3xl tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
