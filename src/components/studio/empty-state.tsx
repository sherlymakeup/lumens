import { MODE_BY_ID } from "@/lib/modes";
import { useStrings } from "@/lib/i18n";
import type { ModeId } from "@/lib/types";
import { MODE_ICONS } from "./icons";

export function EmptyState({
  modeId,
  onPick,
}: {
  modeId: ModeId;
  onPick: (prompt: string) => void;
}) {
  const t = useStrings();
  const mode = MODE_BY_ID[modeId];
  const Icon = MODE_ICONS[modeId];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10">
      <div className="enter-up mb-8 max-w-xl">
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-secondary text-foreground">
          <Icon className="size-5" strokeWidth={1.6} />
        </div>
        <h1 className="font-display text-[2rem] leading-[1.15] tracking-[-0.03em] sm:text-[2.35rem]">
          {t[mode.label]}
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {t[mode.description]}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {mode.starters.map((starter, index) => (
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
