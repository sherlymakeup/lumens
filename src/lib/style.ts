// Opsi gaya bahasa global (pengganti extras per-mode yang sudah dihapus).
// Dipakai di Settings > Generation dan diteruskan ke agent sebagai instruksi.
import type { StringKey } from "./i18n";

export type StyleOption = { value: string; label: StringKey };

export const TONE_OPTIONS: StyleOption[] = [
  { value: "neutral", label: "extra.tone.opt.neutral" },
  { value: "formal", label: "extra.tone.opt.formal" },
  { value: "casual", label: "extra.tone.opt.casual" },
  { value: "persuasive", label: "extra.tone.opt.persuasive" },
  { value: "warm", label: "extra.tone.opt.warm" },
  { value: "direct", label: "extra.tone.opt.direct" },
];

export const LENGTH_OPTIONS: StyleOption[] = [
  { value: "brief", label: "extra.length.opt.brief" },
  { value: "standard", label: "extra.length.opt.standard" },
  { value: "long", label: "extra.length.opt.long" },
];

/** Bangun instruksi gaya untuk system prompt dari settings. */
export function styleInstruction(
  tone: string,
  length: string,
  t: Record<StringKey, string>,
): string {
  const toneLabel =
    TONE_OPTIONS.find((o) => o.value === tone)?.label ?? TONE_OPTIONS[0].label;
  const lengthLabel =
    LENGTH_OPTIONS.find((o) => o.value === length)?.label ?? LENGTH_OPTIONS[1].label;
  return `Style: ${t[toneLabel]}, ${t[lengthLabel]}.`;
}
