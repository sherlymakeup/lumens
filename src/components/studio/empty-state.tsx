import type { ReactNode } from "react";
import { useStrings } from "@/lib/i18n";

const STARTERS = ["empty.s1", "empty.s2", "empty.s3"] as const;

/** Empty state ala Grok: heading besar di tengah, composer tepat di bawahnya. */
export function EmptyState({
  onPick,
  composer,
}: {
  onPick: (prompt: string) => void;
  composer: ReactNode;
}) {
  const t = useStrings();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10">
      <div className="enter-up mb-6 text-center">
        <h1 className="font-display text-[1.9rem] leading-[1.15] font-semibold tracking-[-0.02em] sm:text-[2.4rem]">
          {t["empty.title"]}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {t["empty.desc"]}
        </p>
      </div>
      <div className="enter-up" style={{ animationDelay: "80ms" }}>
        {composer}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {STARTERS.map((starter, index) => (
          <button
            key={starter}
            type="button"
            onClick={() => onPick(t[starter])}
            className="enter-up rounded-2xl bg-card p-4 text-left shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--shadow-border-hover)] active:scale-[0.99]"
            style={{ animationDelay: `${140 + index * 40}ms` }}
          >
            <span className="block text-[13px] leading-relaxed text-foreground/90">{t[starter]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
