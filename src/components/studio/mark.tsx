import { cn } from "@/lib/utils";

export function LumenMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg bg-primary",
        className,
      )}
      aria-hidden
    >
      <span className="h-4 w-0.5 rounded-full bg-primary-foreground" />
    </span>
  );
}
