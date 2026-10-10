import type { ReactNode } from "react";
import { Search, PenLine, Code2, BarChart3, Globe, FileText } from "lucide-react";
import { useStrings } from "@/lib/i18n";

type PromptCard = {
  icon: ReactNode;
  titleKey: "empty.c1t" | "empty.c2t" | "empty.c3t" | "empty.c4t" | "empty.c5t" | "empty.c6t";
  descKey: "empty.c1d" | "empty.c2d" | "empty.c3d" | "empty.c4d" | "empty.c5d" | "empty.c6d";
  promptKey: "empty.c1p" | "empty.c2p" | "empty.c3p" | "empty.c4p" | "empty.c5p" | "empty.c6p";
  accent: string;
};

const CARDS: PromptCard[] = [
  {
    icon: <Search className="size-5" strokeWidth={1.8} />,
    titleKey: "empty.c1t",
    descKey: "empty.c1d",
    promptKey: "empty.c1p",
    accent: "text-sky-400",
  },
  {
    icon: <PenLine className="size-5" strokeWidth={1.8} />,
    titleKey: "empty.c2t",
    descKey: "empty.c2d",
    promptKey: "empty.c2p",
    accent: "text-violet-400",
  },
  {
    icon: <Code2 className="size-5" strokeWidth={1.8} />,
    titleKey: "empty.c3t",
    descKey: "empty.c3d",
    promptKey: "empty.c3p",
    accent: "text-emerald-400",
  },
  {
    icon: <BarChart3 className="size-5" strokeWidth={1.8} />,
    titleKey: "empty.c4t",
    descKey: "empty.c4d",
    promptKey: "empty.c4p",
    accent: "text-amber-400",
  },
  {
    icon: <Globe className="size-5" strokeWidth={1.8} />,
    titleKey: "empty.c5t",
    descKey: "empty.c5d",
    promptKey: "empty.c5p",
    accent: "text-rose-400",
  },
  {
    icon: <FileText className="size-5" strokeWidth={1.8} />,
    titleKey: "empty.c6t",
    descKey: "empty.c6d",
    promptKey: "empty.c6p",
    accent: "text-cyan-400",
  },
];

/** Empty state dengan Prompt Cards visual: ikon + judul + deskripsi. */
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
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card, index) => (
          <button
            key={card.titleKey}
            type="button"
            onClick={() => onPick(t[card.promptKey])}
            className="enter-up group rounded-2xl bg-card p-4 text-left shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--shadow-border-hover)] active:scale-[0.99]"
            style={{ animationDelay: `${140 + index * 40}ms` }}
          >
            <span className={`mb-2.5 inline-flex ${card.accent}`}>{card.icon}</span>
            <span className="block text-sm font-medium text-foreground">
              {t[card.titleKey]}
            </span>
            <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">
              {t[card.descKey]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
