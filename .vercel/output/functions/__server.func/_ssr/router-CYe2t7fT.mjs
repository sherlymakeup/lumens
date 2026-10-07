import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { _ as createFileRoute, b as useRouter, d as Scripts, f as HeadContent, g as lazyRouteComponent, h as Outlet, m as createRouter, v as createRootRoute } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as TriangleAlert } from "../_libs/lucide-react.mjs";
import { a as number, c as union, i as literal, n as array, o as object, r as boolean, s as string, t as _enum } from "../_libs/zod.mjs";
import { t as Provider } from "../_libs/radix-ui__react-tooltip.mjs";
import { n as clsx } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { t as Toaster } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-CYe2t7fT.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function uid() {
	if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
	return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function clamp(n, min, max) {
	return Math.min(max, Math.max(min, n));
}
function truncate(text, max = 48) {
	const clean = text.replace(/\s+/g, " ").trim();
	if (clean.length <= max) return clean;
	return `${clean.slice(0, max - 1)}…`;
}
function TooltipProvider({ delayDuration = 240, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Provider, {
		delayDuration,
		...props
	});
}
function Toaster$1(props) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
		theme: "system",
		className: "toaster group",
		toastOptions: { classNames: {
			toast: "group bg-card text-card-foreground shadow-[var(--shadow-border)] border-0",
			description: "text-muted-foreground"
		} },
		...props
	});
}
var styles_default = "/assets/styles-zPepCPxo.css";
var APP_NAME = "XDIRGA TOOLS";
var Route$6 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "description",
				content: "Ruang kerja AI: chat, generasi konten, desain, prototipe, dan coding via 9Router."
			},
			{
				name: "theme-color",
				content: "#0c0c0d"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		className: "dark antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TooltipProvider, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster$1, {})] }) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
		] })]
	})
});
var $$splitComponentImporter$1 = () => import("./routes-C2p_LPHl.mjs");
var Route$5 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./dashboard-DCSO_hIH.mjs");
var Route$4 = createFileRoute("/dashboard")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var BLOCKED_HOSTS = /* @__PURE__ */ new Set([
	"localhost",
	"127.0.0.1",
	"0.0.0.0",
	"::1",
	"metadata.google.internal"
]);
function isPrivateHostname(hostname) {
	const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
	if (BLOCKED_HOSTS.has(host)) return true;
	if (host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return true;
	const ipv4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
	if (ipv4) {
		const a = Number(ipv4[1]);
		const b = Number(ipv4[2]);
		if (a === 10 || a === 127 || a === 0) return true;
		if (a === 169 && b === 254) return true;
		if (a === 192 && b === 168) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
	}
	if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd") || host === "::" || host.startsWith("::ffff:127.")) return true;
	return false;
}
function normalizeBaseUrl(raw) {
	const trimmed = raw.trim().replace(/\/+$/, "");
	if (!trimmed) throw new Error("Base URL is required.");
	let parsed;
	try {
		parsed = new URL(trimmed);
	} catch {
		throw new Error("Base URL is not valid.");
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("Base URL must use http or https.");
	if (isPrivateHostname(parsed.hostname)) throw new Error("That host is not allowed.");
	return trimmed;
}
function chatCompletionsUrl(baseUrl) {
	return `${normalizeBaseUrl(baseUrl)}/chat/completions`;
}
function modelsUrl(baseUrl) {
	return `${normalizeBaseUrl(baseUrl)}/models`;
}
function imageModelsUrl(baseUrl) {
	return `${normalizeBaseUrl(baseUrl)}/models/image`;
}
function imagesGenerationsUrl(baseUrl) {
	return `${normalizeBaseUrl(baseUrl)}/images/generations`;
}
function gatewayHealthUrl(baseUrl) {
	return `${normalizeBaseUrl(baseUrl).replace(/\/v1$/, "")}/api/health`;
}
var Message = object({
	role: _enum([
		"system",
		"user",
		"assistant"
	]),
	content: string().max(12e3)
});
var Body$1 = object({
	messages: array(Message).min(1).max(24),
	stream: boolean().optional().default(true),
	connection: object({
		provider: _enum(["custom"]),
		model: string().min(1).max(120)
	}),
	params: object({
		temperature: number(),
		maxTokens: number(),
		topP: number(),
		frequencyPenalty: number(),
		presencePenalty: number()
	})
});
function sse(data) {
	return `data: ${JSON.stringify(data)}\n\n`;
}
var Route$3 = createFileRoute("/api/generate")({ server: { handlers: { POST: async ({ request }) => {
	const parsed = Body$1.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
	const { messages, stream, connection, params } = parsed.data;
	const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
	const base = process.env.OPENAI_BASE_URL?.trim() ?? "";
	if (!apiKey || !base) return Response.json({ error: "Server misconfigured: set OPENAI_API_KEY and OPENAI_BASE_URL env vars." }, { status: 503 });
	let url;
	try {
		url = chatCompletionsUrl(base);
	} catch (error) {
		return Response.json({ error: error instanceof Error ? error.message : "Invalid base URL." }, { status: 500 });
	}
	const payload = {
		model: connection.model,
		messages: messages.map((message) => ({
			role: message.role,
			content: message.content.slice(0, 8e3)
		})),
		temperature: clamp(params.temperature, 0, 2),
		max_tokens: clamp(Math.round(params.maxTokens), 16, 4096),
		top_p: clamp(params.topP, 0, 1),
		frequency_penalty: clamp(params.frequencyPenalty, 0, 2),
		presence_penalty: clamp(params.presencePenalty, 0, 2),
		stream
	};
	let upstream;
	try {
		upstream = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
				"User-Agent": "lumens-proxy/1.0"
			},
			body: JSON.stringify(payload),
			signal: request.signal
		});
	} catch (error) {
		if (request.signal.aborted) return new Response(null, { status: 499 });
		return Response.json({ error: error instanceof Error ? error.message : "Could not reach the model." }, { status: 502 });
	}
	if (!upstream.ok) {
		let detail = `Provider error ${upstream.status}`;
		try {
			const errBody = await upstream.json();
			if (typeof errBody.error === "string") detail = errBody.error;
			else if (errBody.error?.message) detail = errBody.error.message;
		} catch {
			const text = await upstream.text().catch(() => "");
			if (text) detail = text.slice(0, 280);
		}
		return Response.json({ error: detail }, { status: 502 });
	}
	if (!stream) {
		const body = await upstream.json();
		return Response.json({ text: body.choices?.[0]?.message?.content ?? "" });
	}
	const encoder = new TextEncoder();
	const decoder = new TextDecoder();
	const readable = new ReadableStream({ async start(controller) {
		const reader = upstream.body?.getReader();
		if (!reader) {
			controller.enqueue(encoder.encode(sse({ error: "Empty stream." })));
			controller.close();
			return;
		}
		let buffer = "";
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";
				for (const raw of lines) {
					const line = raw.trim();
					if (!line.startsWith("data:")) continue;
					const data = line.slice(5).trim();
					if (!data) continue;
					if (data === "[DONE]") {
						controller.enqueue(encoder.encode(sse({ done: true })));
						continue;
					}
					try {
						const delta = JSON.parse(data).choices?.[0]?.delta;
						if (delta?.reasoning_content && !delta.content) controller.enqueue(encoder.encode(sse({ thinking: true })));
						if (delta?.content) controller.enqueue(encoder.encode(sse({ text: delta.content })));
					} catch {}
				}
			}
			controller.enqueue(encoder.encode(sse({ done: true })));
			controller.close();
		} catch (error) {
			if (!request.signal.aborted) {
				const message = error instanceof Error ? error.message : "Stream interrupted.";
				controller.enqueue(encoder.encode(sse({ error: message })));
			}
			controller.close();
		}
	} });
	return new Response(readable, { headers: {
		"Content-Type": "text/event-stream; charset=utf-8",
		"Cache-Control": "no-cache, no-transform",
		Connection: "keep-alive"
	} });
} } } });
var Route$2 = createFileRoute("/api/health")({ server: { handlers: { GET: async () => {
	const key = process.env.OPENAI_API_KEY?.trim() ?? "";
	const base = process.env.OPENAI_BASE_URL?.trim() ?? "";
	if (!key || !base) return Response.json({ error: "Server misconfigured: set OPENAI_API_KEY and OPENAI_BASE_URL env vars." }, { status: 503 });
	let url;
	try {
		url = gatewayHealthUrl(base);
	} catch (error) {
		return Response.json({ error: error instanceof Error ? error.message : "Invalid base URL." }, { status: 500 });
	}
	const started = Date.now();
	try {
		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${key}`,
				"User-Agent": "lumens-proxy/1.0"
			},
			signal: AbortSignal.timeout(12e3)
		});
		const latencyMs = Date.now() - started;
		if (!response.ok) return Response.json({ error: `Health check failed (${response.status})` }, { status: 502 });
		if (!(await response.json().catch(() => null))?.ok) return Response.json({ error: "Gateway reported unhealthy." }, { status: 502 });
		return Response.json({
			ok: true,
			latencyMs
		});
	} catch {
		return Response.json({ error: "Could not reach that endpoint." }, { status: 502 });
	}
} } } });
var Body = object({
	model: string().min(1).max(120),
	prompt: string().min(1).max(4e3),
	size: _enum([
		"1024x1024",
		"1024x1792",
		"1792x1024"
	]).optional(),
	n: number().int().min(1).max(4).optional().default(1)
});
var UPSTREAM_TIMEOUT_MS = 12e4;
function sniffMime(b64) {
	if (b64.startsWith("/9j/")) return "image/jpeg";
	if (b64.startsWith("iVBOR")) return "image/png";
	return "image/png";
}
async function toGeneratedImage(item) {
	if (item.b64_json) {
		const mime = sniffMime(item.b64_json);
		return {
			dataUrl: `data:${mime};base64,${item.b64_json}`,
			mime
		};
	}
	if (item.url) {
		const res = await fetch(item.url, { signal: AbortSignal.timeout(3e4) });
		if (!res.ok) return null;
		const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
		const buf = Buffer.from(await res.arrayBuffer());
		if (!buf.length) return null;
		return {
			dataUrl: `data:${mime};base64,${buf.toString("base64")}`,
			mime
		};
	}
	return null;
}
var Route$1 = createFileRoute("/api/images")({ server: { handlers: { POST: async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
	const { model, prompt, size, n } = parsed.data;
	const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
	const base = process.env.OPENAI_BASE_URL?.trim() ?? "";
	if (!apiKey || !base) return Response.json({ error: "Server misconfigured: set OPENAI_API_KEY and OPENAI_BASE_URL env vars." }, { status: 503 });
	let url;
	try {
		url = imagesGenerationsUrl(base);
	} catch (error) {
		return Response.json({ error: error instanceof Error ? error.message : "Invalid base URL." }, { status: 500 });
	}
	let upstream;
	try {
		upstream = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
				"User-Agent": "lumens-proxy/1.0"
			},
			body: JSON.stringify({
				model,
				prompt: prompt.slice(0, 4e3),
				size,
				n,
				response_format: "b64_json"
			}),
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
		});
	} catch (error) {
		return Response.json({ error: error instanceof Error ? error.message : "Could not reach the model." }, { status: 502 });
	}
	if (!upstream.ok) {
		let detail = `Provider error ${upstream.status}`;
		try {
			const errBody = await upstream.json();
			if (typeof errBody.error === "string") detail = errBody.error;
			else if (errBody.error?.message) detail = errBody.error.message;
		} catch {
			const text = await upstream.text().catch(() => "");
			if (text) detail = text.slice(0, 280);
		}
		return Response.json({ error: detail }, { status: 502 });
	}
	const body = await upstream.json().catch(() => null);
	const items = Array.isArray(body?.data) ? body.data.slice(0, n) : [];
	const images = [];
	for (const item of items) {
		const converted = await toGeneratedImage(item).catch(() => null);
		if (converted) images.push(converted);
	}
	if (!images.length) return Response.json({ error: "The gateway returned no image." }, { status: 502 });
	return Response.json({ images });
} } } });
var Route = createFileRoute("/api/models")({ server: { handlers: { GET: async ({ request }) => {
	const key = process.env.OPENAI_API_KEY?.trim() ?? "";
	const base = process.env.OPENAI_BASE_URL?.trim() ?? "";
	if (!key || !base) return Response.json({ error: "Server misconfigured: set OPENAI_API_KEY and OPENAI_BASE_URL env vars." }, { status: 503 });
	const type = new URL(request.url).searchParams.get("type") ?? "chat";
	if (type !== "chat" && type !== "image") return Response.json({ error: "Invalid type. Use \"chat\" or \"image\"." }, { status: 400 });
	let url;
	try {
		url = type === "image" ? imageModelsUrl(base) : modelsUrl(base);
	} catch (error) {
		return Response.json({ error: error instanceof Error ? error.message : "Invalid base URL." }, { status: 500 });
	}
	try {
		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${key}`,
				"User-Agent": "lumens-proxy/1.0"
			},
			signal: AbortSignal.timeout(12e3)
		});
		if (!response.ok) {
			let detail = `Model list failed (${response.status})`;
			const text = await response.text().catch(() => "");
			if (text) try {
				const errBody = JSON.parse(text);
				if (typeof errBody.error === "string") detail += `: ${errBody.error}`;
				else if (errBody.error?.message) detail += `: ${errBody.error.message}`;
				else detail += `: ${text.slice(0, 200)}`;
			} catch {
				detail += `: ${text.slice(0, 200)}`;
			}
			return Response.json({ error: detail }, { status: 502 });
		}
		const models = ((await response.json()).data ?? []).map((item) => ({
			id: item.id ?? "",
			owned_by: item.owned_by ?? ""
		})).filter((model) => Boolean(model.id)).slice(0, 80);
		return Response.json({ models });
	} catch {
		return Response.json({ error: "Could not reach that endpoint." }, { status: 502 });
	}
} } } });
var rootRouteChildren = {
	IndexRoute: Route$5.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$6
	}),
	DashboardRoute: Route$4.update({
		id: "/dashboard",
		path: "/dashboard",
		getParentRoute: () => Route$6
	}),
	ApiGenerateRoute: Route$3.update({
		id: "/api/generate",
		path: "/api/generate",
		getParentRoute: () => Route$6
	}),
	ApiHealthRoute: Route$2.update({
		id: "/api/health",
		path: "/api/health",
		getParentRoute: () => Route$6
	}),
	ApiImagesRoute: Route$1.update({
		id: "/api/images",
		path: "/api/images",
		getParentRoute: () => Route$6
	}),
	ApiModelsRoute: Route.update({
		id: "/api/models",
		path: "/api/models",
		getParentRoute: () => Route$6
	})
};
var routeTree = Route$6._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { uid as i, cn as n, truncate as r, router_exports as t };
