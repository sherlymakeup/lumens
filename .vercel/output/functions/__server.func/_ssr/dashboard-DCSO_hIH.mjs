import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { D as ArrowRight, b as Image, c as RefreshCw, f as MessagesSquare, l as Plug } from "../_libs/lucide-react.mjs";
import { n as cn } from "./router-CYe2t7fT.mjs";
import { _ as fetchModels, l as Sidebar, m as checkHealth, o as Sheet, s as SheetContent, t as Button, u as Skeleton, y as useStudio } from "./sidebar-ko61NaSp.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/dashboard-DCSO_hIH.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var ENGINES = [
	{
		id: "content",
		name: "Generasi Konten",
		description: "Artikel, copy landing, dan terjemahan yang tetap on-brand.",
		glyph: "C"
	},
	{
		id: "design",
		name: "Desain",
		description: "Dari prompt ke visual — frame hero dan konsep UI di kanvas.",
		glyph: "D"
	},
	{
		id: "prototype",
		name: "Prototipe",
		description: "Jelaskan aplikasinya, dapatkan pratinjau yang bisa diklik.",
		glyph: "P"
	},
	{
		id: "code",
		name: "Coding",
		description: "Chat paham repo, diff inline, dan pratinjau sandbox.",
		glyph: "{ }"
	}
];
function StatusDot({ state }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-block size-2 rounded-full", state === "ok" && "bg-emerald-500", state === "error" && "bg-red-500", state === "loading" && "animate-pulse bg-muted-foreground"),
		"aria-hidden": true
	});
}
function Dashboard() {
	const sidebarOpen = useStudio((s) => s.sidebarOpen);
	const setSidebarOpen = useStudio((s) => s.setSidebarOpen);
	const [health, setHealth] = (0, import_react.useState)(null);
	const [healthError, setHealthError] = (0, import_react.useState)(null);
	const [healthLoading, setHealthLoading] = (0, import_react.useState)(true);
	const [chatModels, setChatModels] = (0, import_react.useState)([]);
	const [imageModels, setImageModels] = (0, import_react.useState)([]);
	const [modelsError, setModelsError] = (0, import_react.useState)(null);
	const [modelsLoading, setModelsLoading] = (0, import_react.useState)(true);
	const loadHealth = (0, import_react.useCallback)(async () => {
		setHealthLoading(true);
		setHealthError(null);
		try {
			setHealth(await checkHealth());
		} catch (error) {
			setHealth(null);
			setHealthError(error instanceof Error ? error.message : "Gagal memeriksa koneksi.");
		} finally {
			setHealthLoading(false);
		}
	}, []);
	const loadModels = (0, import_react.useCallback)(async () => {
		setModelsLoading(true);
		setModelsError(null);
		try {
			const [chat, image] = await Promise.all([fetchModels("chat"), fetchModels("image")]);
			setChatModels(chat);
			setImageModels(image);
		} catch (error) {
			setModelsError(error instanceof Error ? error.message : "Gagal memuat model.");
		} finally {
			setModelsLoading(false);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		loadHealth();
		loadModels();
	}, [loadHealth, loadModels]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-dvh overflow-hidden bg-background text-foreground",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
				className: "hidden h-dvh w-64 shrink-0 border-r border-sidebar-border md:block",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sidebar, {})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
				open: sidebarOpen,
				onOpenChange: setSidebarOpen,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, {
					side: "left",
					title: "Menus",
					className: "p-0 max-w-72",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sidebar, {})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				className: "min-h-0 min-w-0 flex-1 overflow-y-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto max-w-4xl px-4 py-8 sm:px-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium tracking-widest text-muted-foreground uppercase",
							children: "Ruang Kerja"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-display mt-2 text-3xl tracking-tight",
							children: "Dasbor"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-muted-foreground",
							children: "Satu pintu ke semua mesin AI — lewat satu gateway: 9Router."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-6 grid gap-3 sm:grid-cols-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-xl border border-border bg-card p-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground uppercase",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plug, { className: "size-3.5" }), " Koneksi"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-3 flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, { state: healthLoading ? "loading" : health ? "ok" : "error" }), healthLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-5 w-24" }) : health ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-sm font-medium",
												children: [
													"9Router · ",
													health.latencyMs,
													"ms"
												]
											}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-sm font-medium text-red-500",
												children: "Terputus"
											})]
										}),
										healthError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mt-1 truncate text-xs text-muted-foreground",
											title: healthError,
											children: healthError
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mt-1 text-xs text-muted-foreground",
											children: "ai.xdirga.xyz"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											variant: "ghost",
											size: "sm",
											className: "mt-3 h-8 gap-1.5 px-2",
											onClick: () => void loadHealth(),
											disabled: healthLoading,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: cn("size-3.5", healthLoading && "animate-spin") }), "Uji koneksi"]
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-xl border border-border bg-card p-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground uppercase",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessagesSquare, { className: "size-3.5" }), " Model Chat"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "mt-3 text-2xl font-semibold tracking-tight",
											children: modelsLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-8 w-12" }) : chatModels.length
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mt-1 truncate text-xs text-muted-foreground",
											title: chatModels[0] ?? "",
											children: modelsError ?? chatModels[0] ?? "—"
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-xl border border-border bg-card p-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground uppercase",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Image, { className: "size-3.5" }), " Model Gambar"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "mt-3 text-2xl font-semibold tracking-tight",
											children: modelsLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-8 w-12" }) : imageModels.length
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mt-1 truncate text-xs text-muted-foreground",
											title: imageModels[0] ?? "",
											children: modelsError ?? imageModels[0] ?? "—"
										})
									]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-8 flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-display text-xl tracking-tight",
								children: "Mesin"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-muted-foreground",
								children: "via 9Router"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 grid gap-3 sm:grid-cols-2",
							children: ENGINES.map((engine) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/",
								className: "group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 font-mono text-sm font-semibold text-primary",
											children: engine.glyph
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "flex-1 text-sm font-medium",
											children: engine.name
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" })
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs leading-relaxed text-muted-foreground",
									children: engine.description
								})]
							}, engine.id))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 text-xs text-muted-foreground",
							children: "Mesin Desain, Prototipe, dan Coding akan diaktifkan penuh di Fase 3."
						})
					]
				})
			})
		]
	});
}
function DashboardPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dashboard, {});
}
//#endregion
export { DashboardPage as component };
