import { Skeleton } from "@/components/ui/skeleton";
import { LumenMark } from "./mark";

export function StudioSkeleton() {
  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar p-4 md:flex md:flex-col">
        <div className="mb-6 flex items-center gap-3">
          <LumenMark />
          <div>
            <div className="font-display text-xl leading-none">XDIRGA TOOLS</div>
            <div className="mt-1 text-xs tracking-wide text-muted-foreground uppercase">Studio</div>
          </div>
        </div>
        <Skeleton className="mb-5 h-10 w-full rounded-md" />
        <div className="space-y-1.5">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full rounded-md" />
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <div>
            <div className="text-sm font-medium">Write</div>
            <div className="text-xs text-muted-foreground">Long-form prose</div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-md" />
            <Skeleton className="size-9 rounded-md" />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10">
          <h1 className="font-display text-3xl tracking-tight">Write</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Draft essays, articles, stories, and structured documents from a brief.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </main>
        <div className="mx-auto w-full max-w-3xl px-4 pb-6">
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function MessageSkeleton() {
  return (
    <div className="space-y-3 py-4" aria-hidden>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-4 w-[92%]" />
      <Skeleton className="h-4 w-[78%]" />
      <Skeleton className="h-4 w-[64%]" />
    </div>
  );
}
