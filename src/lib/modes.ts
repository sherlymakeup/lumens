import type { ExtraField, ModeId } from "./types";
import type { StringKey } from "./i18n";

export type StudioMode = {
  id: ModeId;
  label: StringKey;
  hint: StringKey;
  description: StringKey;
  placeholder: StringKey;
  system: string;
  starters: StringKey[];
  extras: ExtraField[];
};

const TONE: ExtraField = {
  key: "tone",
  label: "extra.tone.label",
  defaultValue: "neutral",
  options: [
    { value: "neutral", label: "extra.tone.opt.neutral" },
    { value: "formal", label: "extra.tone.opt.formal" },
    { value: "casual", label: "extra.tone.opt.casual" },
    { value: "persuasive", label: "extra.tone.opt.persuasive" },
    { value: "warm", label: "extra.tone.opt.warm" },
    { value: "direct", label: "extra.tone.opt.direct" },
  ],
};

const LENGTH: ExtraField = {
  key: "length",
  label: "extra.length.label",
  defaultValue: "standard",
  options: [
    { value: "brief", label: "extra.length.opt.brief" },
    { value: "standard", label: "extra.length.opt.standard" },
    { value: "long", label: "extra.length.opt.long" },
  ],
};

const LANGUAGE: ExtraField = {
  key: "language",
  label: "extra.language.label",
  defaultValue: "english",
  options: [
    { value: "english", label: "extra.language.opt.english" },
    { value: "indonesian", label: "extra.language.opt.indonesian" },
    { value: "japanese", label: "extra.language.opt.japanese" },
    { value: "spanish", label: "extra.language.opt.spanish" },
    { value: "french", label: "extra.language.opt.french" },
    { value: "german", label: "extra.language.opt.german" },
    { value: "mandarin", label: "extra.language.opt.mandarin" },
    { value: "korean", label: "extra.language.opt.korean" },
    { value: "arabic", label: "extra.language.opt.arabic" },
    { value: "portuguese", label: "extra.language.opt.portuguese" },
  ],
};

export const MODES: StudioMode[] = [
  {
    id: "chat",
    label: "mode.chat.label",
    hint: "mode.chat.hint",
    description: "mode.chat.desc",
    placeholder: "mode.chat.placeholder",
    system:
      "You are XDIRGA, a precise, calm assistant. Answer directly. Use markdown when it helps. Do not add filler openings.",
    starters: [
      "mode.chat.s1",
      "mode.chat.s2",
      "mode.chat.s3",
    ],
    extras: [],
  },
  {
    id: "write",
    label: "mode.write.label",
    hint: "mode.write.hint",
    description: "mode.write.desc",
    placeholder: "mode.write.placeholder",
    system:
      "You are Lumen Write. Produce complete, well-structured prose in markdown. Lead with the piece itself — no preamble about what you will do. Match the requested tone and length. Prefer concrete language over hype.",
    starters: [
      "mode.write.s1",
      "mode.write.s2",
      "mode.write.s3",
    ],
    extras: [TONE, LENGTH],
  },
  {
    id: "rewrite",
    label: "mode.rewrite.label",
    hint: "mode.rewrite.hint",
    description: "mode.rewrite.desc",
    placeholder: "mode.rewrite.placeholder",
    system:
      "You are Lumen Rewrite. Return only the rewritten text unless the user asks for a diff. Preserve meaning, names, and facts. Improve rhythm and clarity.",
    starters: [
      "mode.rewrite.s1",
      "mode.rewrite.s2",
      "mode.rewrite.s3",
    ],
    extras: [
      {
        key: "action",
        label: "extra.action.label",
        defaultValue: "improve",
        options: [
          { value: "improve", label: "extra.action.opt.improve" },
          { value: "shorten", label: "extra.action.opt.shorten" },
          { value: "expand", label: "extra.action.opt.expand" },
          { value: "simplify", label: "extra.action.opt.simplify" },
          { value: "rephrase", label: "extra.action.opt.rephrase" },
        ],
      },
      TONE,
    ],
  },
  {
    id: "summarize",
    label: "mode.summarize.label",
    hint: "mode.summarize.hint",
    description: "mode.summarize.desc",
    placeholder: "mode.summarize.placeholder",
    system:
      "You are Lumen Summarize. Extract the load-bearing points. Prefer a short headline, then bullets or a tight paragraph. Do not invent facts that are not in the source.",
    starters: [
      "mode.summarize.s1",
      "mode.summarize.s2",
      "mode.summarize.s3",
    ],
    extras: [LENGTH],
  },
  {
    id: "translate",
    label: "mode.translate.label",
    hint: "mode.translate.hint",
    description: "mode.translate.desc",
    placeholder: "mode.translate.placeholder",
    system:
      "You are Lumen Translate. Produce a natural translation in the target language. Preserve tone and proper nouns. If a phrase is idiomatic, translate the meaning, not the words. Return the translation first.",
    starters: [
      "mode.translate.s1",
      "mode.translate.s2",
      "mode.translate.s3",
    ],
    extras: [
      { ...LANGUAGE, key: "target", label: "extra.target.label", defaultValue: "indonesian" },
    ],
  },
  {
    id: "code",
    label: "mode.code.label",
    hint: "mode.code.hint",
    description: "mode.code.desc",
    placeholder: "mode.code.placeholder",
    system:
      "You are Lumen Code. Write correct, minimal code. Explain only what is necessary. Use fenced blocks with a language tag. Call out edge cases and failure modes.",
    starters: [
      "mode.code.s1",
      "mode.code.s2",
      "mode.code.s3",
    ],
    extras: [
      {
        key: "language",
        label: "extra.stack.label",
        defaultValue: "typescript",
        options: [
          { value: "typescript", label: "extra.stack.opt.typescript" },
          { value: "python", label: "extra.stack.opt.python" },
          { value: "go", label: "extra.stack.opt.go" },
          { value: "rust", label: "extra.stack.opt.rust" },
          { value: "sql", label: "extra.stack.opt.sql" },
          { value: "bash", label: "extra.stack.opt.bash" },
        ],
      },
    ],
  },
  {
    id: "email",
    label: "mode.email.label",
    hint: "mode.email.hint",
    description: "mode.email.desc",
    placeholder: "mode.email.placeholder",
    system:
      "You are Lumen Email. Write a ready-to-send email with a subject line. Keep it human and specific. No padded greetings, no 'I hope this finds you well' unless the user asks for a warm register.",
    starters: [
      "mode.email.s1",
      "mode.email.s2",
      "mode.email.s3",
    ],
    extras: [
      {
        key: "kind",
        label: "extra.kind.label",
        defaultValue: "request",
        options: [
          { value: "request", label: "extra.kind.opt.request" },
          { value: "followup", label: "extra.kind.opt.followup" },
          { value: "update", label: "extra.kind.opt.update" },
          { value: "intro", label: "extra.kind.opt.intro" },
          { value: "apology", label: "extra.kind.opt.apology" },
          { value: "decline", label: "extra.kind.opt.decline" },
        ],
      },
      TONE,
    ],
  },
  {
    id: "social",
    label: "mode.social.label",
    hint: "mode.social.hint",
    description: "mode.social.desc",
    placeholder: "mode.social.placeholder",
    system:
      "You are Lumen Social. Write copy that can be posted as-is. Avoid hashtag spam, emoji stuffing, and engagement bait. Match the platform's length and rhythm. Offer one primary draft, then two lighter variations if useful.",
    starters: [
      "mode.social.s1",
      "mode.social.s2",
      "mode.social.s3",
    ],
    extras: [
      {
        key: "platform",
        label: "extra.platform.label",
        defaultValue: "x",
        options: [
          { value: "x", label: "extra.platform.opt.x" },
          { value: "linkedin", label: "extra.platform.opt.linkedin" },
          { value: "instagram", label: "extra.platform.opt.instagram" },
          { value: "thread", label: "extra.platform.opt.thread" },
        ],
      },
      TONE,
    ],
  },
  {
    id: "ideas",
    label: "mode.ideas.label",
    hint: "mode.ideas.hint",
    description: "mode.ideas.desc",
    placeholder: "mode.ideas.placeholder",
    system:
      "You are Lumen Ideas. Generate distinct options, not near-duplicates. Group them. Mark 1–2 you would actually ship and say why. Be opinionated.",
    starters: [
      "mode.ideas.s1",
      "mode.ideas.s2",
      "mode.ideas.s3",
    ],
    extras: [
      {
        key: "count",
        label: "extra.count.label",
        defaultValue: "ten",
        options: [
          { value: "five", label: "extra.count.opt.five" },
          { value: "ten", label: "extra.count.opt.ten" },
          { value: "twenty", label: "extra.count.opt.twenty" },
        ],
      },
    ],
  },
  {
    id: "explain",
    label: "mode.explain.label",
    hint: "mode.explain.hint",
    description: "mode.explain.desc",
    placeholder: "mode.explain.placeholder",
    system:
      "You are Lumen Explain. Teach clearly. Start with the one-sentence version, then the mechanism, then a concrete example. Avoid jargon unless you define it. No quiz-show energy.",
    starters: [
      "mode.explain.s1",
      "mode.explain.s2",
      "mode.explain.s3",
    ],
    extras: [
      {
        key: "level",
        label: "extra.level.label",
        defaultValue: "practitioner",
        options: [
          { value: "eli5", label: "extra.level.opt.eli5" },
          { value: "student", label: "extra.level.opt.student" },
          { value: "practitioner", label: "extra.level.opt.practitioner" },
          { value: "expert", label: "extra.level.opt.expert" },
        ],
      },
    ],
  },
];

export const MODE_BY_ID: Record<ModeId, StudioMode> = Object.fromEntries(
  MODES.map((mode) => [mode.id, mode]),
) as Record<ModeId, StudioMode>;

/** Mode yang tampil di pemilih mode — "write" disembunyikan dari navigasi
 *  (duplikasi dengan Agent), tapi definisinya tetap ada untuk kompatibilitas
 *  percakapan lama. */
export const VISIBLE_MODES: StudioMode[] = MODES.filter((mode) => mode.id !== "write");

export function defaultExtras(modeId: ModeId): Record<string, string> {
  const extras: Record<string, string> = {};
  for (const field of MODE_BY_ID[modeId].extras) {
    extras[field.key] = field.defaultValue;
  }
  return extras;
}

export function extrasInstruction(
  modeId: ModeId,
  extras: Record<string, string>,
  t: Record<StringKey, string>,
) {
  const mode = MODE_BY_ID[modeId];
  if (mode.extras.length === 0) return "";
  const lines = mode.extras.map((field) => {
    const value = extras[field.key] ?? field.defaultValue;
    const opt = field.options.find((option) => option.value === value);
    const label = opt ? t[opt.label] : value;
    return `${t[field.label]}: ${label}`;
  });
  return `Constraints:\n${lines.join("\n")}`;
}
