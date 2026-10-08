import type { ExtraField, ModeId } from "./types";

export type StudioMode = {
  id: ModeId;
  label: string;
  hint: string;
  description: string;
  placeholder: string;
  system: string;
  starters: string[];
  extras: ExtraField[];
};

const TONE: ExtraField = {
  key: "tone",
  label: "Tone",
  defaultValue: "neutral",
  options: [
    { value: "neutral", label: "Neutral" },
    { value: "formal", label: "Formal" },
    { value: "casual", label: "Casual" },
    { value: "persuasive", label: "Persuasive" },
    { value: "warm", label: "Warm" },
    { value: "direct", label: "Direct" },
  ],
};

const LENGTH: ExtraField = {
  key: "length",
  label: "Length",
  defaultValue: "standard",
  options: [
    { value: "brief", label: "Brief" },
    { value: "standard", label: "Standard" },
    { value: "long", label: "Long" },
  ],
};

const LANGUAGE: ExtraField = {
  key: "language",
  label: "Language",
  defaultValue: "english",
  options: [
    { value: "english", label: "English" },
    { value: "indonesian", label: "Bahasa Indonesia" },
    { value: "japanese", label: "Japanese" },
    { value: "spanish", label: "Spanish" },
    { value: "french", label: "French" },
    { value: "german", label: "German" },
    { value: "mandarin", label: "Mandarin" },
    { value: "korean", label: "Korean" },
    { value: "arabic", label: "Arabic" },
    { value: "portuguese", label: "Portuguese" },
  ],
};

export const MODES: StudioMode[] = [
  {
    id: "chat",
    label: "Chat",
    hint: "Think out loud",
    description: "Open-ended conversation for questions, planning, and back-and-forth.",
    placeholder: "Ask anything…",
    system:
      "You are XDIRGA, a precise, calm assistant. Answer directly. Use markdown when it helps. Do not add filler openings.",
    starters: [
      "Help me decide between two product directions — I'll paste the brief.",
      "What are the trade-offs of streaming vs batch APIs for a chat product?",
      "Interview me about my project until you can write a one-page brief.",
    ],
    extras: [],
  },
  {
    id: "write",
    label: "Write",
    hint: "Long-form prose",
    description: "Draft essays, articles, stories, and structured documents from a brief.",
    placeholder: "Describe the piece: audience, angle, and any facts to include…",
    system:
      "You are Lumen Write. Produce complete, well-structured prose in markdown. Lead with the piece itself — no preamble about what you will do. Match the requested tone and length. Prefer concrete language over hype.",
    starters: [
      "Write a 700-word essay on why constraint makes software feel considered.",
      "Draft a product narrative for a quiet notes app aimed at writers.",
      "Write a short story set in a 24-hour library that only exists when it rains.",
    ],
    extras: [TONE, LENGTH],
  },
  {
    id: "rewrite",
    label: "Rewrite",
    hint: "Sharpen existing text",
    description: "Paraphrase, tighten, expand, or shift tone without losing meaning.",
    placeholder: "Paste the text to rewrite. Add a note about what to change…",
    system:
      "You are Lumen Rewrite. Return only the rewritten text unless the user asks for a diff. Preserve meaning, names, and facts. Improve rhythm and clarity.",
    starters: [
      "Tighten this announcement so it sounds confident, not salesy.",
      "Rewrite this paragraph in plain language a 14-year-old would follow.",
      "Expand this bullet outline into a polished two-paragraph intro.",
    ],
    extras: [
      {
        key: "action",
        label: "Action",
        defaultValue: "improve",
        options: [
          { value: "improve", label: "Improve" },
          { value: "shorten", label: "Shorten" },
          { value: "expand", label: "Expand" },
          { value: "simplify", label: "Simplify" },
          { value: "rephrase", label: "Rephrase" },
        ],
      },
      TONE,
    ],
  },
  {
    id: "summarize",
    label: "Summarize",
    hint: "Compress to signal",
    description: "Turn long notes, articles, or transcripts into a usable brief.",
    placeholder: "Paste the source text or notes to summarize…",
    system:
      "You are Lumen Summarize. Extract the load-bearing points. Prefer a short headline, then bullets or a tight paragraph. Do not invent facts that are not in the source.",
    starters: [
      "Summarize this meeting transcript into decisions, owners, and open questions.",
      "Give me a one-paragraph abstract plus five bullets of key claims.",
      "Turn this article into a briefing I can read in 90 seconds.",
    ],
    extras: [LENGTH],
  },
  {
    id: "translate",
    label: "Translate",
    hint: "Across languages",
    description: "Faithful translation that keeps register, idiom, and intent.",
    placeholder: "Paste text to translate. Mention any terms to keep as-is…",
    system:
      "You are Lumen Translate. Produce a natural translation in the target language. Preserve tone and proper nouns. If a phrase is idiomatic, translate the meaning, not the words. Return the translation first.",
    starters: [
      "Translate this product tagline into Bahasa Indonesia, keeping it short.",
      "Translate this support email into Japanese, polite but not stiff.",
      "Translate this paragraph into Spanish for a professional newsletter.",
    ],
    extras: [
      { ...LANGUAGE, key: "target", label: "Target", defaultValue: "indonesian" },
    ],
  },
  {
    id: "code",
    label: "Code",
    hint: "Read, write, explain",
    description: "Generate, review, and explain code with working examples.",
    placeholder: "Describe the function, paste a snippet, or ask for a review…",
    system:
      "You are Lumen Code. Write correct, minimal code. Explain only what is necessary. Use fenced blocks with a language tag. Call out edge cases and failure modes.",
    starters: [
      "Write a TypeScript function that parses OpenAI-style SSE chat streams.",
      "Review this React component for accessibility and suggest a patch.",
      "Explain this regex and replace it with a readable parser.",
    ],
    extras: [
      {
        key: "language",
        label: "Stack",
        defaultValue: "typescript",
        options: [
          { value: "typescript", label: "TypeScript" },
          { value: "python", label: "Python" },
          { value: "go", label: "Go" },
          { value: "rust", label: "Rust" },
          { value: "sql", label: "SQL" },
          { value: "bash", label: "Bash" },
        ],
      },
    ],
  },
  {
    id: "email",
    label: "Email",
    hint: "Correspondence",
    description: "Draft clear emails for outreach, follow-ups, requests, and updates.",
    placeholder: "Who is this to, what do you need, and any context they have…",
    system:
      "You are Lumen Email. Write a ready-to-send email with a subject line. Keep it human and specific. No padded greetings, no 'I hope this finds you well' unless the user asks for a warm register.",
    starters: [
      "Ask a designer for one more revision without sounding frustrated.",
      "Follow up on a proposal sent last Tuesday. Keep it short.",
      "Decline a meeting and offer two written alternatives.",
    ],
    extras: [
      {
        key: "kind",
        label: "Kind",
        defaultValue: "request",
        options: [
          { value: "request", label: "Request" },
          { value: "followup", label: "Follow-up" },
          { value: "update", label: "Update" },
          { value: "intro", label: "Intro" },
          { value: "apology", label: "Apology" },
          { value: "decline", label: "Decline" },
        ],
      },
      TONE,
    ],
  },
  {
    id: "social",
    label: "Social",
    hint: "Short public copy",
    description: "Captions, posts, and threads that sound like a person, not a brand bot.",
    placeholder: "What should the post say, and who is it for…",
    system:
      "You are Lumen Social. Write copy that can be posted as-is. Avoid hashtag spam, emoji stuffing, and engagement bait. Match the platform's length and rhythm. Offer one primary draft, then two lighter variations if useful.",
    starters: [
      "Write an X post announcing a writing studio with streaming AI drafts.",
      "LinkedIn post about shipping a small tool instead of a platform.",
      "Instagram caption for a photo of a desk at dusk — quiet, not cute.",
    ],
    extras: [
      {
        key: "platform",
        label: "Platform",
        defaultValue: "x",
        options: [
          { value: "x", label: "X" },
          { value: "linkedin", label: "LinkedIn" },
          { value: "instagram", label: "Instagram" },
          { value: "thread", label: "Thread" },
        ],
      },
      TONE,
    ],
  },
  {
    id: "ideas",
    label: "Ideas",
    hint: "Diverge, then pick",
    description: "Brainstorm names, outlines, angles, and options with a clear structure.",
    placeholder: "What are you exploring? Constraints help…",
    system:
      "You are Lumen Ideas. Generate distinct options, not near-duplicates. Group them. Mark 1–2 you would actually ship and say why. Be opinionated.",
    starters: [
      "Give me 12 names for a calm AI writing studio. No invented Latin.",
      "Outline three structures for a 1,200-word essay on attention.",
      "Brainstorm launch angles for a local-first markdown app.",
    ],
    extras: [
      {
        key: "count",
        label: "Volume",
        defaultValue: "ten",
        options: [
          { value: "five", label: "5" },
          { value: "ten", label: "10" },
          { value: "twenty", label: "20" },
        ],
      },
    ],
  },
  {
    id: "explain",
    label: "Explain",
    hint: "Make it click",
    description: "Teach a concept at the right altitude, with examples.",
    placeholder: "What should be explained, and to whom…",
    system:
      "You are Lumen Explain. Teach clearly. Start with the one-sentence version, then the mechanism, then a concrete example. Avoid jargon unless you define it. No quiz-show energy.",
    starters: [
      "Explain SSE streaming as if I have shipped REST but never used it.",
      "What actually happens when you press Send in a chat app?",
      "Explain temperature, top-p, and max tokens with one cooking metaphor each — then drop the metaphor.",
    ],
    extras: [
      {
        key: "level",
        label: "Level",
        defaultValue: "practitioner",
        options: [
          { value: "eli5", label: "ELI5" },
          { value: "student", label: "Student" },
          { value: "practitioner", label: "Practitioner" },
          { value: "expert", label: "Expert" },
        ],
      },
    ],
  },
];

export const MODE_BY_ID: Record<ModeId, StudioMode> = Object.fromEntries(
  MODES.map((mode) => [mode.id, mode]),
) as Record<ModeId, StudioMode>;

export function defaultExtras(modeId: ModeId): Record<string, string> {
  const extras: Record<string, string> = {};
  for (const field of MODE_BY_ID[modeId].extras) {
    extras[field.key] = field.defaultValue;
  }
  return extras;
}

export function extrasInstruction(modeId: ModeId, extras: Record<string, string>) {
  const mode = MODE_BY_ID[modeId];
  if (mode.extras.length === 0) return "";
  const lines = mode.extras.map((field) => {
    const value = extras[field.key] ?? field.defaultValue;
    const label = field.options.find((option) => option.value === value)?.label ?? value;
    return `${field.label}: ${label}`;
  });
  return `Constraints:\n${lines.join("\n")}`;
}
