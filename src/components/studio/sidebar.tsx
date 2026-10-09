import {
  Blocks,
  Bot,
  Code2,
  FolderKanban,
  LayoutDashboard,
  LayoutTemplate,
  Palette,
  PenLine,
  Plug,
  Plus,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";
import { LumenMark } from "./mark";
import { useStrings, type StringKey } from "@/lib/i18n";

const WORKSPACE_NAV = [
  { to: "/dashboard", labelKey: "nav.dashboard", Icon: LayoutDashboard },
  { to: "/", labelKey: "nav.chat", Icon: Bot },
] as const;

const ENGINE_NAV = [
  { to: "/engines/content", labelKey: "eng.contentTitle", Icon: PenLine },
  { to: "/engines/design", labelKey: "eng.designTitle", Icon: Palette },
  { to: "/engines/prototype", labelKey: "eng.prototypeTitle", Icon: LayoutTemplate },
  { to: "/engines/code", labelKey: "eng.codeTitle", Icon: Code2 },
] as const;

const MANAGE_NAV = [
  { to: "/projects", labelKey: "proj.title", Icon: FolderKanban },
  { to: "/connection", labelKey: "conn.title", Icon: Plug },
  { to: "/connectors", labelKey: "ctr.title", Icon: Blocks },
] as const;

function NavLinks({
  items,
  onNavigate,
}: {
  items: readonly { to: string; labelKey: StringKey; Icon: typeof LayoutDashboard }[];
  onNavigate: () => void;
}) {
  const t = useStrings();
  return (
    <nav className="space-y-0.5 pb-4">
      {items.map(({ to, labelKey, Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          activeProps={{
            className:
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm bg-sidebar-accent text-foreground",
          }}
          inactiveProps={{
            className:
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground transition-colors duration-150",
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm"
        >
          <Icon className="size-4 shrink-0" strokeWidth={1.7} />
          <span className="min-w-0 flex-1 truncate">{t[labelKey]}</span>
        </Link>
      ))}
    </nav>
  );
}

function NavHeading({ children }: { children: string }) {
  return (
    <p className="px-2 pt-1 pb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
      {children}
    </p>
  );
}

export function Sidebar({ className }: { className?: string }) {
  const newConversation = useStudio((s) => s.newConversation);
  const setSidebarOpen = useStudio((s) => s.setSidebarOpen);
  const t = useStrings();

  return (
    <div className={cn("flex h-full flex-col bg-sidebar text-sidebar-foreground", className)}>
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <LumenMark />
        <div>
          <div className="font-display text-xl leading-none tracking-tight">XDIRGA <span className="text-primary">TOOLS</span></div>
          <div className="mt-1 text-[11px] tracking-wide text-muted-foreground uppercase">
            AI Workspace
          </div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <Button className="w-full justify-center" onClick={() => newConversation()}>
          <Plus className="size-4" />
          {t["nav.newChat"]}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2">
        <NavHeading>{t["nav.workspace"]}</NavHeading>
        <NavLinks items={WORKSPACE_NAV} onNavigate={() => setSidebarOpen(false)} />
        <NavHeading>{t["nav.engines"]}</NavHeading>
        <NavLinks items={ENGINE_NAV} onNavigate={() => setSidebarOpen(false)} />
        <NavHeading>{t["nav.manage"]}</NavHeading>
        <NavLinks items={MANAGE_NAV} onNavigate={() => setSidebarOpen(false)} />
      </ScrollArea>
    </div>
  );
}
