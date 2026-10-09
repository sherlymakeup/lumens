import { Bot } from "lucide-react";
import { useStrings } from "@/lib/i18n";

const STARTERS = ["empty.s1", "empty.s2", "empty.s3"] as const;

export function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  const t = useStrings();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10">
      <div className="enter-up mb-8 max-w-xl">
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-secondary text-foreground">
          <Bot className="size-5" strokeWidth={1.6} />
        </div>
        <h1 className="font-display text-[2rem] leading-[1.15] tracking-[-0.03em] sm:text-[2.35rem]">
          {t["empty.title"]}
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {t["empty.desc"]}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {STARTERS.map((starter, index) => (
          <button
            key={starter}
            type="button"
            onClick={() => onPick(t[starter])}
            className="enter-up rounded-2xl bg-card p-4 text-left shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--shadow-border-hover)] active:scale-[0.99]"
            style={{ animationDelay: `${80 + index * 40}ms` }}
          >
            <span className="block text-[13px] leading-relaxed text-foreground/90">{t[starter]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
