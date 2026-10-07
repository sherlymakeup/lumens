import "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as Slot, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { C as CodeXml, E as BookOpen, _ as ListCollapse, a as Shapes, d as PenLine, g as Mail, h as Megaphone, p as MessageSquare, r as Trash2, s as Repeat2, t as X, u as Plus, v as LayoutDashboard, y as Languages } from "../_libs/lucide-react.mjs";
import { a as DialogPortal, i as DialogOverlay, n as DialogClose, o as DialogTitle, r as DialogContent, t as Dialog } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { i as uid, n as cn, r as truncate } from "./router-CYe2t7fT.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
import { i as Viewport, n as Scrollbar, r as Thumb, t as Root } from "../_libs/radix-ui__react-scroll-area.mjs";
require_react();
var import_jsx_runtime = require_jsx_runtime();
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[opacity,transform,background-color,box-shadow,color] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:not-disabled:scale-[0.96]", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground hover:opacity-90",
			secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
			outline: "bg-transparent shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)] hover:bg-accent",
			ghost: "hover:bg-accent hover:text-accent-foreground",
			destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
			link: "text-foreground underline-offset-4 hover:underline"
		},
		size: {
			default: "h-10 px-4",
			sm: "h-8 rounded-md px-3 text-[13px]",
			lg: "h-11 rounded-lg px-5",
			icon: "size-10",
			"icon-sm": "size-8"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
function Button({ className, variant, size, asChild = false, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		"data-slot": "button",
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		...props
	});
}
function Sheet({ ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, { ...props });
}
function SheetOverlay({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, {
		className: cn("fixed inset-0 z-50 bg-background/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
		...props
	});
}
function SheetContent({ className, children, side = "right", title = "Panel", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
		"aria-describedby": void 0,
		className: cn("fixed z-50 flex h-full flex-col bg-card text-card-foreground shadow-[var(--shadow-border)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-150 data-[state=open]:duration-400", side === "right" && "inset-y-0 right-0 w-full max-w-lg data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right", side === "left" && "inset-y-0 left-0 w-full max-w-80 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left", className),
		...props,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
				className: "sr-only",
				children: title
			}),
			children,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
				className: "absolute top-3 right-3 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "sr-only",
					children: "Close"
				})]
			})
		]
	})] });
}
function SheetHeader({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("border-b border-border px-5 py-4 pr-12", className),
		...props
	});
}
function Skeleton({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("animate-pulse rounded-md bg-muted", className),
		...props
	});
}
function parseSseBuffer(buffer, onEvent) {
	const parts = buffer.split("\n\n");
	const rest = parts.pop() ?? "";
	for (const part of parts) {
		const line = part.split("\n").filter((row) => row.startsWith("data:")).map((row) => row.slice(5).trim()).join("");
		if (line) onEvent(line);
	}
	return rest;
}
async function generateStream(request, handlers) {
	let response;
	try {
		response = await fetch("/api/generate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(request),
			signal: handlers.signal
		});
	} catch (error) {
		if (handlers.signal?.aborted) {
			handlers.onDone();
			return;
		}
		handlers.onError(error instanceof Error ? error.message : "Network error");
		return;
	}
	if (!response.ok) {
		let message = `Request failed (${response.status})`;
		try {
			const body = await response.json();
			if (body.error) message = body.error;
		} catch {
			const text = await response.text().catch(() => "");
			if (text) message = text.slice(0, 280);
		}
		handlers.onError(message);
		return;
	}
	const contentType = response.headers.get("content-type") ?? "";
	if (!request.stream || !contentType.includes("text/event-stream")) {
		const body = await response.json();
		if (body.error) {
			handlers.onError(body.error);
			return;
		}
		if (body.text) handlers.onDelta(body.text);
		handlers.onDone();
		return;
	}
	const reader = response.body?.getReader();
	if (!reader) {
		handlers.onError("No response stream.");
		return;
	}
	const decoder = new TextDecoder();
	let buffer = "";
	let failed = false;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		buffer = parseSseBuffer(buffer, (payload) => {
			if (payload === "[DONE]" || failed) return;
			try {
				const json = JSON.parse(payload);
				if (json.error) {
					failed = true;
					handlers.onError(json.error);
					return;
				}
				if (json.thinking) handlers.onThinking?.();
				if (json.text) handlers.onDelta(json.text);
			} catch {}
		});
	}
	if (!failed) handlers.onDone();
}
async function fetchModels(type = "chat") {
	const response = await fetch(`/api/models?type=${type}`, { method: "GET" });
	const body = await response.json();
	if (!response.ok) throw new Error(body.error ?? "Could not list models");
	return (body.models ?? []).map((model) => typeof model === "string" ? model : model.id).filter((id) => Boolean(id));
}
async function checkHealth() {
	const response = await fetch("/api/health", { method: "GET" });
	const body = await response.json();
	if (!response.ok || !body.ok) throw new Error(body.error ?? "Health check failed");
	return {
		ok: true,
		latencyMs: body.latencyMs ?? 0
	};
}
var TONE = {
	key: "tone",
	label: "Tone",
	defaultValue: "neutral",
	options: [
		{
			value: "neutral",
			label: "Neutral"
		},
		{
			value: "formal",
			label: "Formal"
		},
		{
			value: "casual",
			label: "Casual"
		},
		{
			value: "persuasive",
			label: "Persuasive"
		},
		{
			value: "warm",
			label: "Warm"
		},
		{
			value: "direct",
			label: "Direct"
		}
	]
};
var LENGTH = {
	key: "length",
	label: "Length",
	defaultValue: "standard",
	options: [
		{
			value: "brief",
			label: "Brief"
		},
		{
			value: "standard",
			label: "Standard"
		},
		{
			value: "long",
			label: "Long"
		}
	]
};
var MODES = [
	{
		id: "chat",
		label: "Chat",
		hint: "Think out loud",
		description: "Open-ended conversation for questions, planning, and back-and-forth.",
		placeholder: "Ask anything, or paste a problem to work through…",
		system: "You are XDIRGA, a precise, calm assistant. Answer directly. Use markdown when it helps. Do not add filler openings.",
		starters: [
			"Help me decide between two product directions — I'll paste the brief.",
			"What are the trade-offs of streaming vs batch APIs for a chat product?",
			"Interview me about my project until you can write a one-page brief."
		],
		extras: []
	},
	{
		id: "write",
		label: "Write",
		hint: "Long-form prose",
		description: "Draft essays, articles, stories, and structured documents from a brief.",
		placeholder: "Describe the piece: audience, angle, and any facts to include…",
		system: "You are Lumen Write. Produce complete, well-structured prose in markdown. Lead with the piece itself — no preamble about what you will do. Match the requested tone and length. Prefer concrete language over hype.",
		starters: [
			"Write a 700-word essay on why constraint makes software feel considered.",
			"Draft a product narrative for a quiet notes app aimed at writers.",
			"Write a short story set in a 24-hour library that only exists when it rains."
		],
		extras: [TONE, LENGTH]
	},
	{
		id: "rewrite",
		label: "Rewrite",
		hint: "Sharpen existing text",
		description: "Paraphrase, tighten, expand, or shift tone without losing meaning.",
		placeholder: "Paste the text to rewrite. Add a note about what to change…",
		system: "You are Lumen Rewrite. Return only the rewritten text unless the user asks for a diff. Preserve meaning, names, and facts. Improve rhythm and clarity.",
		starters: [
			"Tighten this announcement so it sounds confident, not salesy.",
			"Rewrite this paragraph in plain language a 14-year-old would follow.",
			"Expand this bullet outline into a polished two-paragraph intro."
		],
		extras: [{
			key: "action",
			label: "Action",
			defaultValue: "improve",
			options: [
				{
					value: "improve",
					label: "Improve"
				},
				{
					value: "shorten",
					label: "Shorten"
				},
				{
					value: "expand",
					label: "Expand"
				},
				{
					value: "simplify",
					label: "Simplify"
				},
				{
					value: "rephrase",
					label: "Rephrase"
				}
			]
		}, TONE]
	},
	{
		id: "summarize",
		label: "Summarize",
		hint: "Compress to signal",
		description: "Turn long notes, articles, or transcripts into a usable brief.",
		placeholder: "Paste the source text or notes to summarize…",
		system: "You are Lumen Summarize. Extract the load-bearing points. Prefer a short headline, then bullets or a tight paragraph. Do not invent facts that are not in the source.",
		starters: [
			"Summarize this meeting transcript into decisions, owners, and open questions.",
			"Give me a one-paragraph abstract plus five bullets of key claims.",
			"Turn this article into a briefing I can read in 90 seconds."
		],
		extras: [LENGTH]
	},
	{
		id: "translate",
		label: "Translate",
		hint: "Across languages",
		description: "Faithful translation that keeps register, idiom, and intent.",
		placeholder: "Paste text to translate. Mention any terms to keep as-is…",
		system: "You are Lumen Translate. Produce a natural translation in the target language. Preserve tone and proper nouns. If a phrase is idiomatic, translate the meaning, not the words. Return the translation first.",
		starters: [
			"Translate this product tagline into Bahasa Indonesia, keeping it short.",
			"Translate this support email into Japanese, polite but not stiff.",
			"Translate this paragraph into Spanish for a professional newsletter."
		],
		extras: [{
			key: "language",
			label: "Language",
			defaultValue: "english",
			options: [
				{
					value: "english",
					label: "English"
				},
				{
					value: "indonesian",
					label: "Bahasa Indonesia"
				},
				{
					value: "japanese",
					label: "Japanese"
				},
				{
					value: "spanish",
					label: "Spanish"
				},
				{
					value: "french",
					label: "French"
				},
				{
					value: "german",
					label: "German"
				},
				{
					value: "mandarin",
					label: "Mandarin"
				},
				{
					value: "korean",
					label: "Korean"
				},
				{
					value: "arabic",
					label: "Arabic"
				},
				{
					value: "portuguese",
					label: "Portuguese"
				}
			],
			key: "target",
			label: "Target",
			defaultValue: "indonesian"
		}]
	},
	{
		id: "code",
		label: "Code",
		hint: "Read, write, explain",
		description: "Generate, review, and explain code with working examples.",
		placeholder: "Describe the function, paste a snippet, or ask for a review…",
		system: "You are Lumen Code. Write correct, minimal code. Explain only what is necessary. Use fenced blocks with a language tag. Call out edge cases and failure modes.",
		starters: [
			"Write a TypeScript function that parses OpenAI-style SSE chat streams.",
			"Review this React component for accessibility and suggest a patch.",
			"Explain this regex and replace it with a readable parser."
		],
		extras: [{
			key: "language",
			label: "Stack",
			defaultValue: "typescript",
			options: [
				{
					value: "typescript",
					label: "TypeScript"
				},
				{
					value: "python",
					label: "Python"
				},
				{
					value: "go",
					label: "Go"
				},
				{
					value: "rust",
					label: "Rust"
				},
				{
					value: "sql",
					label: "SQL"
				},
				{
					value: "bash",
					label: "Bash"
				}
			]
		}]
	},
	{
		id: "email",
		label: "Email",
		hint: "Correspondence",
		description: "Draft clear emails for outreach, follow-ups, requests, and updates.",
		placeholder: "Who is this to, what do you need, and any context they have…",
		system: "You are Lumen Email. Write a ready-to-send email with a subject line. Keep it human and specific. No padded greetings, no 'I hope this finds you well' unless the user asks for a warm register.",
		starters: [
			"Ask a designer for one more revision without sounding frustrated.",
			"Follow up on a proposal sent last Tuesday. Keep it short.",
			"Decline a meeting and offer two written alternatives."
		],
		extras: [{
			key: "kind",
			label: "Kind",
			defaultValue: "request",
			options: [
				{
					value: "request",
					label: "Request"
				},
				{
					value: "followup",
					label: "Follow-up"
				},
				{
					value: "update",
					label: "Update"
				},
				{
					value: "intro",
					label: "Intro"
				},
				{
					value: "apology",
					label: "Apology"
				},
				{
					value: "decline",
					label: "Decline"
				}
			]
		}, TONE]
	},
	{
		id: "social",
		label: "Social",
		hint: "Short public copy",
		description: "Captions, posts, and threads that sound like a person, not a brand bot.",
		placeholder: "What should the post say, and who is it for…",
		system: "You are Lumen Social. Write copy that can be posted as-is. Avoid hashtag spam, emoji stuffing, and engagement bait. Match the platform's length and rhythm. Offer one primary draft, then two lighter variations if useful.",
		starters: [
			"Write an X post announcing a writing studio with streaming AI drafts.",
			"LinkedIn post about shipping a small tool instead of a platform.",
			"Instagram caption for a photo of a desk at dusk — quiet, not cute."
		],
		extras: [{
			key: "platform",
			label: "Platform",
			defaultValue: "x",
			options: [
				{
					value: "x",
					label: "X"
				},
				{
					value: "linkedin",
					label: "LinkedIn"
				},
				{
					value: "instagram",
					label: "Instagram"
				},
				{
					value: "thread",
					label: "Thread"
				}
			]
		}, TONE]
	},
	{
		id: "ideas",
		label: "Ideas",
		hint: "Diverge, then pick",
		description: "Brainstorm names, outlines, angles, and options with a clear structure.",
		placeholder: "What are you exploring? Constraints help…",
		system: "You are Lumen Ideas. Generate distinct options, not near-duplicates. Group them. Mark 1–2 you would actually ship and say why. Be opinionated.",
		starters: [
			"Give me 12 names for a calm AI writing studio. No invented Latin.",
			"Outline three structures for a 1,200-word essay on attention.",
			"Brainstorm launch angles for a local-first markdown app."
		],
		extras: [{
			key: "count",
			label: "Volume",
			defaultValue: "ten",
			options: [
				{
					value: "five",
					label: "5"
				},
				{
					value: "ten",
					label: "10"
				},
				{
					value: "twenty",
					label: "20"
				}
			]
		}]
	},
	{
		id: "explain",
		label: "Explain",
		hint: "Make it click",
		description: "Teach a concept at the right altitude, with examples.",
		placeholder: "What should be explained, and to whom…",
		system: "You are Lumen Explain. Teach clearly. Start with the one-sentence version, then the mechanism, then a concrete example. Avoid jargon unless you define it. No quiz-show energy.",
		starters: [
			"Explain SSE streaming as if I have shipped REST but never used it.",
			"What actually happens when you press Send in a chat app?",
			"Explain temperature, top-p, and max tokens with one cooking metaphor each — then drop the metaphor."
		],
		extras: [{
			key: "level",
			label: "Level",
			defaultValue: "practitioner",
			options: [
				{
					value: "eli5",
					label: "ELI5"
				},
				{
					value: "student",
					label: "Student"
				},
				{
					value: "practitioner",
					label: "Practitioner"
				},
				{
					value: "expert",
					label: "Expert"
				}
			]
		}]
	}
];
var MODE_BY_ID = Object.fromEntries(MODES.map((mode) => [mode.id, mode]));
function defaultExtras(modeId) {
	const extras = {};
	for (const field of MODE_BY_ID[modeId].extras) extras[field.key] = field.defaultValue;
	return extras;
}
function extrasInstruction(modeId, extras) {
	const mode = MODE_BY_ID[modeId];
	if (mode.extras.length === 0) return "";
	return `Constraints:\n${mode.extras.map((field) => {
		const value = extras[field.key] ?? field.defaultValue;
		const label = field.options.find((option) => option.value === value)?.label ?? value;
		return `${field.label}: ${label}`;
	}).join("\n")}`;
}
function resolveDark(theme) {
	if (theme === "dark") return true;
	if (theme === "light") return false;
	if (typeof window === "undefined") return true;
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function applyTheme(theme) {
	if (typeof document === "undefined") return;
	const dark = resolveDark(theme);
	const root = document.documentElement;
	root.classList.toggle("dark", dark);
	root.classList.toggle("light", !dark);
	root.style.colorScheme = dark ? "dark" : "light";
}
function applyFontSize(size) {
	if (typeof document === "undefined") return;
	document.documentElement.dataset.fontSize = size;
}
function applyDensity(density) {
	if (typeof document === "undefined") return;
	document.documentElement.dataset.density = density;
}
var DEFAULT_SETTINGS = {
	provider: "custom",
	model: "",
	temperature: .7,
	maxTokens: 1024,
	topP: 1,
	frequencyPenalty: 0,
	presencePenalty: 0,
	stream: true,
	theme: "dark",
	fontSize: "md",
	density: "comfortable",
	sendWithEnter: true,
	showMarkdown: true,
	systemPromptOverride: ""
};
function applyChrome(settings) {
	applyTheme(settings.theme);
	applyFontSize(settings.fontSize);
	applyDensity(settings.density);
}
var useStudio = create()(persist((set, get) => ({
	hydrated: false,
	settings: DEFAULT_SETTINGS,
	conversations: [],
	activeId: null,
	modeId: "write",
	sidebarOpen: false,
	settingsOpen: false,
	settingsSection: "connection",
	streamingId: null,
	setHydrated: () => {
		applyChrome(get().settings);
		set({ hydrated: true });
	},
	setSettings: (partial) => {
		const settings = {
			...get().settings,
			...partial
		};
		applyChrome(settings);
		set({ settings });
	},
	resetSettings: () => {
		applyChrome(DEFAULT_SETTINGS);
		set({ settings: DEFAULT_SETTINGS });
	},
	setMode: (modeId) => {
		const existing = get().conversations.filter((item) => item.modeId === modeId).sort((a, b) => b.updatedAt - a.updatedAt)[0];
		set({
			modeId,
			activeId: existing?.id ?? null,
			sidebarOpen: false
		});
	},
	setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
	setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
	setSettingsSection: (settingsSection) => set({ settingsSection }),
	newConversation: (modeId) => {
		const mode = modeId ?? get().modeId;
		const now = Date.now();
		const conversation = {
			id: uid(),
			modeId: mode,
			title: "Untitled",
			extras: defaultExtras(mode),
			messages: [],
			createdAt: now,
			updatedAt: now
		};
		set((state) => ({
			modeId: mode,
			activeId: conversation.id,
			conversations: [conversation, ...state.conversations],
			sidebarOpen: false
		}));
		return conversation.id;
	},
	selectConversation: (id) => {
		const found = get().conversations.find((item) => item.id === id);
		if (!found) return;
		set({
			activeId: id,
			modeId: found.modeId,
			sidebarOpen: false
		});
	},
	deleteConversation: (id) => {
		const { conversations, activeId, modeId } = get();
		const next = conversations.filter((item) => item.id !== id);
		const fallback = activeId === id ? next.find((item) => item.modeId === modeId) ?? next[0] ?? null : conversations.find((item) => item.id === activeId) ?? null;
		set({
			conversations: next,
			activeId: fallback?.id ?? null,
			modeId: fallback?.modeId ?? modeId
		});
	},
	setExtras: (conversationId, extras) => {
		set((state) => ({ conversations: state.conversations.map((item) => item.id === conversationId ? {
			...item,
			extras,
			updatedAt: Date.now()
		} : item) }));
	},
	addMessage: (conversationId, message) => {
		set((state) => ({ conversations: state.conversations.map((item) => {
			if (item.id !== conversationId) return item;
			const title = item.title === "Untitled" && message.role === "user" ? truncate(message.content || MODE_BY_ID[item.modeId].label, 42) : item.title;
			return {
				...item,
				title,
				messages: [...item.messages, message],
				updatedAt: Date.now()
			};
		}) }));
	},
	patchMessage: (conversationId, messageId, patch) => {
		set((state) => ({ conversations: state.conversations.map((item) => item.id === conversationId ? {
			...item,
			updatedAt: Date.now(),
			messages: item.messages.map((message) => message.id === messageId ? {
				...message,
				...patch
			} : message)
		} : item) }));
	},
	setStreamingId: (streamingId) => set({ streamingId }),
	clearAll: () => set({
		conversations: [],
		activeId: null,
		streamingId: null
	})
}), {
	name: "chat-studio-v1",
	partialize: (state) => ({
		settings: state.settings,
		conversations: state.conversations,
		activeId: state.activeId,
		modeId: state.modeId
	}),
	onRehydrateStorage: () => (state) => {
		state?.setHydrated();
	}
}));
function ScrollArea({ className, children, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Root, {
		className: cn("relative overflow-hidden", className),
		...props,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Viewport, {
			className: "h-full w-full rounded-[inherit]",
			children
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scrollbar, {
			orientation: "vertical",
			className: "flex w-2 touch-none p-px select-none",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thumb, { className: "relative flex-1 rounded-full bg-border" })
		})]
	});
}
var MODE_ICONS = {
	chat: MessageSquare,
	write: PenLine,
	rewrite: Repeat2,
	summarize: ListCollapse,
	translate: Languages,
	code: CodeXml,
	email: Mail,
	social: Megaphone,
	ideas: Shapes,
	explain: BookOpen
};
function LumenMark({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex size-8 items-center justify-center rounded-lg bg-primary", className),
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-4 w-0.5 rounded-full bg-primary-foreground" })
	});
}
var WORKSPACE_NAV = [{
	to: "/dashboard",
	label: "Dasbor",
	Icon: LayoutDashboard
}, {
	to: "/",
	label: "Chat",
	Icon: MessageSquare
}];
function Sidebar({ className }) {
	const modeId = useStudio((s) => s.modeId);
	const conversations = useStudio((s) => s.conversations);
	const activeId = useStudio((s) => s.activeId);
	const setMode = useStudio((s) => s.setMode);
	const newConversation = useStudio((s) => s.newConversation);
	const selectConversation = useStudio((s) => s.selectConversation);
	const deleteConversation = useStudio((s) => s.deleteConversation);
	const setSidebarOpen = useStudio((s) => s.setSidebarOpen);
	const recent = conversations.filter((item) => item.modeId === modeId).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 18);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("flex h-full flex-col bg-sidebar text-sidebar-foreground", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3 px-4 pt-5 pb-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LumenMark, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "font-display text-xl leading-none tracking-tight",
					children: ["XDIRGA ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-primary",
						children: "TOOLS"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 text-[11px] tracking-wide text-muted-foreground uppercase",
					children: "AI Workspace"
				})] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "px-3 pb-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					className: "w-full justify-center",
					onClick: () => newConversation(),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }),
						"New ",
						MODES.find((mode) => mode.id === modeId)?.label
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ScrollArea, {
				className: "flex-1 px-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-2 pt-1 pb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase",
						children: "Ruang Kerja"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "space-y-0.5 pb-4",
						children: WORKSPACE_NAV.map(({ to, label, Icon }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to,
							onClick: () => setSidebarOpen(false),
							activeProps: { className: "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm bg-sidebar-accent text-foreground" },
							inactiveProps: { className: "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground transition-colors duration-150" },
							className: "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
								className: "size-4 shrink-0",
								strokeWidth: 1.7
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "min-w-0 flex-1 truncate",
								children: label
							})]
						}, to))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-2 pt-1 pb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase",
						children: "Menus"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "space-y-0.5 pb-4",
						children: MODES.map((mode) => {
							const Icon = MODE_ICONS[mode.id];
							const active = mode.id === modeId;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setMode(mode.id),
								className: cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-150", active ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground"),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
										className: "size-4 shrink-0",
										strokeWidth: 1.7
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "min-w-0 flex-1 truncate",
										children: mode.label
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "hidden text-[11px] text-muted-foreground lg:inline",
										children: mode.hint
									})
								]
							}, mode.id);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-2 pt-2 pb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase",
						children: "This menu"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-0.5 pb-6",
						children: recent.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "px-2.5 py-3 text-xs text-muted-foreground",
							children: "No drafts yet."
						}) : recent.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: cn("group flex items-center rounded-lg pr-1", item.id === activeId ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/70"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => selectConversation(item.id),
								className: "min-w-0 flex-1 truncate px-2.5 py-2 text-left text-sm",
								children: item.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								"aria-label": "Delete draft",
								onClick: () => deleteConversation(item.id),
								className: "rounded-md p-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
							})]
						}, item.id))
					})
				]
			})
		]
	});
}
//#endregion
export { fetchModels as _, ScrollArea as a, SheetHeader as c, applyDensity as d, applyFontSize as f, extrasInstruction as g, defaultExtras as h, MODE_ICONS as i, Sidebar as l, checkHealth as m, DEFAULT_SETTINGS as n, Sheet as o, applyTheme as p, MODE_BY_ID as r, SheetContent as s, Button as t, Skeleton as u, generateStream as v, useStudio as y };
