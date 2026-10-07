import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { S as Copy, T as Check, c as RefreshCw, i as Square, m as Menu, o as Settings2, w as ChevronDown, x as CornerDownLeft } from "../_libs/lucide-react.mjs";
import { a as SelectItemIndicator, c as SelectTrigger$1, i as SelectItem$1, l as SelectValue$1, n as SelectContent$1, o as SelectItemText, r as SelectIcon, s as SelectPortal, t as Select$1, u as SelectViewport } from "../_libs/@radix-ui/react-select+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { i as uid, n as cn } from "./router-CYe2t7fT.mjs";
import { _ as fetchModels, a as ScrollArea, c as SheetHeader, d as applyDensity, f as applyFontSize, g as extrasInstruction, h as defaultExtras, i as MODE_ICONS, l as Sidebar, m as checkHealth, n as DEFAULT_SETTINGS, o as Sheet, p as applyTheme, r as MODE_BY_ID, s as SheetContent, t as Button, u as Skeleton, v as generateStream, y as useStudio } from "./sidebar-ko61NaSp.mjs";
import { t as Root } from "../_libs/radix-ui__react-label.mjs";
import { i as SliderTrack, n as SliderRange, r as SliderThumb, t as Slider$1 } from "../_libs/radix-ui__react-slider.mjs";
import { n as SwitchThumb, t as Switch$1 } from "../_libs/radix-ui__react-switch.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-C2p_LPHl.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Select({ ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select$1, { ...props });
}
function SelectValue({ ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue$1, { ...props });
}
function SelectTrigger({ className, children, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectTrigger$1, {
		className: cn("flex h-10 w-full items-center justify-between gap-2 rounded-md bg-card px-3 text-sm shadow-[var(--shadow-border)] outline-none transition-[box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 [&>span]:line-clamp-1", className),
		...props,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectIcon, {
			asChild: true,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4 text-muted-foreground" })
		})]
	});
}
function SelectContent({ className, children, position = "popper", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectPortal, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent$1, {
		position,
		className: cn("relative z-50 max-h-72 min-w-[8rem] overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-[var(--shadow-border)] animate-in fade-in-0 zoom-in-95", className),
		...props,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectViewport, {
			className: "p-1",
			children
		})
	}) });
}
function SelectItem({ className, children, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectItem$1, {
		className: cn("relative flex w-full cursor-pointer items-center rounded-md py-2 pr-8 pl-2 text-sm outline-none select-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className),
		...props,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItemText, { children }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItemIndicator, {
			className: "absolute right-2",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" })
		})]
	});
}
function Composer({ modeId, extras, onExtras, value, onChange, onSubmit, onStop, streaming, disabled }) {
	const mode = MODE_BY_ID[modeId];
	const ref = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const el = ref.current;
		if (!el) return;
		el.style.height = "0px";
		el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
	}, [value]);
	function onKeyDown(event) {
		const sendOnEnter = document.documentElement.dataset.sendEnter === "1";
		if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && sendOnEnter) {
			event.preventDefault();
			if (!streaming && value.trim()) onSubmit();
			return;
		}
		if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			if (!streaming && value.trim()) onSubmit();
		}
	}
	const sendOnEnter = typeof document !== "undefined" && document.documentElement.dataset.sendEnter === "1";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mx-auto w-full max-w-3xl shrink-0 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-2xl bg-card p-2 shadow-[var(--shadow-border)]",
			children: [
				mode.extras.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-2 px-2 pt-1.5 pb-2",
					children: mode.extras.map((field) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs font-medium tracking-wide text-muted-foreground uppercase",
							children: field.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
							value: extras[field.key] ?? field.defaultValue,
							onValueChange: (next) => onExtras({
								...extras,
								[field.key]: next
							}),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
								className: "h-8 w-auto min-w-28 gap-2 bg-transparent px-2.5 text-xs",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: field.options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: option.value,
								children: option.label
							}, option.value)) })]
						})]
					}, field.key))
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
					ref,
					value,
					onChange: (event) => onChange(event.target.value),
					onKeyDown,
					placeholder: mode.placeholder,
					disabled,
					rows: 3,
					className: cn("max-h-70 min-h-24 w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50")
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-3 px-2 pt-1 pb-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: streaming ? "Generating…" : sendOnEnter ? "Enter untuk kirim · Shift + Enter baris baru" : "Ctrl/⌘ + Enter untuk kirim"
					}), streaming ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "outline",
						onClick: onStop,
						className: "h-10 min-w-22",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "size-3.5 fill-current" }), "Stop"]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: onSubmit,
						disabled: disabled || !value.trim(),
						className: "h-10 min-w-22",
						children: ["Send", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CornerDownLeft, { className: "size-3.5" })]
					})]
				})
			]
		})
	});
}
function EmptyState({ modeId, onPick }) {
	const mode = MODE_BY_ID[modeId];
	const Icon = MODE_ICONS[modeId];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "enter-up mb-8 max-w-xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-4 flex size-11 items-center justify-center rounded-xl bg-secondary text-foreground",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
						className: "size-5",
						strokeWidth: 1.6
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-[2rem] leading-[1.15] tracking-[-0.03em] sm:text-[2.35rem]",
					children: mode.label
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 max-w-md text-sm leading-relaxed text-muted-foreground",
					children: mode.description
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid gap-3 sm:grid-cols-2",
			children: mode.starters.map((starter, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => onPick(starter),
				className: "enter-up rounded-2xl bg-card p-4 text-left shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--shadow-border-hover)] active:scale-[0.99]",
				style: { animationDelay: `${80 + index * 40}ms` },
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block text-[13px] leading-relaxed text-foreground/90",
					children: starter
				})
			}, starter))
		})]
	});
}
function HealthChip() {
	const [state, setState] = (0, import_react.useState)("loading");
	const [latency, setLatency] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		checkHealth().then((health) => {
			if (cancelled) return;
			setState("ok");
			setLatency(health.latencyMs);
		}, () => {
			if (cancelled) return;
			setState("error");
		});
		return () => {
			cancelled = true;
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground sm:inline-flex",
		title: state === "ok" ? `9Router tersambung (${latency}ms)` : "9Router",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: cn("inline-block size-1.5 rounded-full", state === "ok" && "bg-emerald-500", state === "error" && "bg-red-500", state === "loading" && "animate-pulse bg-muted-foreground"),
				"aria-hidden": true
			}),
			"9Router",
			state === "ok" && latency !== null ? ` · ${latency}ms` : ""
		]
	});
}
function Header({ models }) {
	const modeId = useStudio((s) => s.modeId);
	const settings = useStudio((s) => s.settings);
	const setSettings = useStudio((s) => s.setSettings);
	const setSidebarOpen = useStudio((s) => s.setSidebarOpen);
	const setSettingsOpen = useStudio((s) => s.setSettingsOpen);
	const mode = MODE_BY_ID[modeId];
	const options = models;
	const modelValue = options.includes(settings.model) ? settings.model : void 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "ghost",
				size: "icon",
				className: "md:hidden",
				"aria-label": "Open menu",
				onClick: () => setSidebarOpen(true),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-5" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "truncate text-sm font-medium",
					children: mode.label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "truncate text-[11px] text-muted-foreground",
					children: mode.hint
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HealthChip, {}),
			options.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
				value: modelValue,
				onValueChange: (model) => setSettings({ model }),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
					className: "h-9 w-[9.5rem] bg-transparent sm:w-44",
					"aria-label": "Model",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Pilih model" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: options.map((model) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
					value: model,
					children: model
				}, model)) })]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "hidden max-w-36 truncate px-1 text-xs text-muted-foreground sm:block",
				title: settings.model || "Buka Settings lalu Test connection untuk memuat daftar model",
				children: settings.model || "Belum ada model"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "outline",
				size: "icon",
				"aria-label": "Open settings",
				onClick: () => setSettingsOpen(true),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings2, { className: "size-4" })
			})
		]
	});
}
var ESC = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;"
};
function escapeHtml(text) {
	return text.replace(/[&<>"]/g, (ch) => ESC[ch] ?? ch);
}
function inlineToHtml(text) {
	let html = escapeHtml(text);
	html = html.replace(/`([^`]+)`/g, "<code class=\"md-icode\">$1</code>");
	html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
	html = html.replace(/(^|[^\w])\*([^*]+)\*(?!\w)/g, "$1<em>$2</em>");
	html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "<a href=\"$2\" target=\"_blank\" rel=\"noreferrer noopener\">$1</a>");
	return html;
}
function parseBlocks(source) {
	const lines = source.replaceAll("\r\n", "\n").split("\n");
	const blocks = [];
	let i = 0;
	while (i < lines.length) {
		const line = lines[i] ?? "";
		if (line.startsWith("```")) {
			const lang = line.slice(3).trim();
			const body = [];
			i += 1;
			while (i < lines.length && !lines[i]?.startsWith("```")) {
				body.push(lines[i] ?? "");
				i += 1;
			}
			blocks.push({
				type: "code",
				lang,
				body: body.join("\n")
			});
			i += 1;
			continue;
		}
		if (/^---+$/.test(line.trim())) {
			blocks.push({ type: "hr" });
			i += 1;
			continue;
		}
		const heading = /^(#{1,3})\s+(.+)$/.exec(line);
		if (heading) {
			blocks.push({
				type: "heading",
				level: heading[1].length,
				text: heading[2]
			});
			i += 1;
			continue;
		}
		if (line.startsWith("> ")) {
			const quote = [];
			while (i < lines.length && (lines[i]?.startsWith("> ") || lines[i] === ">")) {
				quote.push((lines[i] ?? "").replace(/^>\s?/, ""));
				i += 1;
			}
			blocks.push({
				type: "quote",
				text: quote.join("\n")
			});
			continue;
		}
		if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
			const ordered = /^\s*\d+\.\s+/.test(line);
			const items = [];
			while (i < lines.length && (ordered ? /^\s*\d+\.\s+/.test(lines[i] ?? "") : /^\s*[-*]\s+/.test(lines[i] ?? ""))) {
				items.push((lines[i] ?? "").replace(/^\s*(?:[-*]|\d+\.)\s+/, ""));
				i += 1;
			}
			blocks.push({
				type: "list",
				ordered,
				items
			});
			continue;
		}
		if (line.trim() === "") {
			i += 1;
			continue;
		}
		const para = [];
		while (i < lines.length && (lines[i] ?? "").trim() !== "" && !isFenceOrBlock(lines[i] ?? "")) {
			para.push(lines[i] ?? "");
			i += 1;
		}
		blocks.push({
			type: "p",
			text: para.join("\n")
		});
	}
	return blocks;
}
function isFenceOrBlock(line) {
	return line.startsWith("```") || /^#{1,3}\s+/.test(line) || line.startsWith("> ") || /^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line) || /^---+$/.test(line.trim());
}
function Markdown({ content, className }) {
	const blocks = parseBlocks(content);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("md-body", className),
		children: blocks.map((block, index) => {
			if (block.type === "code") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("pre", {
				className: "md-pre",
				children: [block.lang ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "md-lang",
					children: block.lang
				}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: block.body })]
			}, index);
			if (block.type === "heading") {
				const Tag = `h${block.level}`;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tag, {
					className: cn("text-balance", block.level === 1 && "md-h1", block.level === 2 && "md-h2", block.level === 3 && "md-h3"),
					dangerouslySetInnerHTML: { __html: inlineToHtml(block.text) }
				}, index);
			}
			if (block.type === "quote") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("blockquote", {
				className: "md-quote",
				dangerouslySetInnerHTML: { __html: inlineToHtml(block.text) }
			}, index);
			if (block.type === "list") {
				const Tag = block.ordered ? "ol" : "ul";
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tag, {
					className: block.ordered ? "md-ol" : "md-ul",
					children: block.items.map((item, itemIndex) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { dangerouslySetInnerHTML: { __html: inlineToHtml(item) } }, itemIndex))
				}, index);
			}
			if (block.type === "hr") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("hr", { className: "md-hr" }, index);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "md-p",
				dangerouslySetInnerHTML: { __html: inlineToHtml(block.text) }
			}, index);
		})
	});
}
function MessageSkeleton() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3 py-4",
		"aria-hidden": true,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-3 w-16" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-4 w-[92%]" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-4 w-[78%]" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-4 w-[64%]" })
		]
	});
}
function MessageList({ messages, streamingId, thinking, showMarkdown, onRegenerate }) {
	const lastAssistant = [...messages].reverse().find((item) => item.role === "assistant");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-8",
		children: messages.map((message, index) => {
			const streaming = streamingId === message.id;
			const empty = streaming && !message.content && !message.error;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: "enter-up",
				style: { animationDelay: `${Math.min(index, 4) * 40}ms` },
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: cn("mb-2 text-[11px] font-medium tracking-wider uppercase", message.role === "user" ? "text-muted-foreground" : "text-foreground"),
						children: message.role === "user" ? "You" : "XDIRGA"
					}),
					empty ? thinking ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "shimmer-text text-sm",
						children: "Thinking"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSkeleton, {}) : message.role === "assistant" && showMarkdown && !message.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Markdown, { content: message.content }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "whitespace-pre-wrap text-[15px] leading-relaxed",
						children: message.content
					}),
					streaming && message.content ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "stream-caret" }) : null,
					message.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-destructive",
						children: message.error
					}) : null,
					message.role === "assistant" && !streaming && message.content ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "ghost",
							size: "sm",
							className: "h-8 px-2 text-muted-foreground",
							onClick: async () => {
								await navigator.clipboard.writeText(message.content);
								toast.success("Copied");
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5" }), "Copy"]
						}), lastAssistant?.id === message.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "ghost",
							size: "sm",
							className: "h-8 px-2 text-muted-foreground",
							onClick: onRegenerate,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-3.5" }), "Regen"]
						}) : null]
					}) : null
				]
			}, message.id);
		})
	});
}
function Input({ className, type, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		type,
		"data-slot": "input",
		className: cn("h-10 w-full min-w-0 rounded-md bg-card px-3 text-sm text-foreground shadow-[var(--shadow-border)] outline-none transition-[box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50", className),
		...props
	});
}
function Label({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Root, {
		"data-slot": "label",
		className: cn("text-[13px] font-medium text-foreground", className),
		...props
	});
}
function Slider({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Slider$1, {
		className: cn("relative flex w-full touch-none items-center select-none", className),
		...props,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderTrack, {
			className: "relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderRange, { className: "absolute h-full bg-primary" })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderThumb, { className: "block size-4 rounded-full bg-primary shadow-[var(--shadow-border)] outline-none transition-[box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring/50" })]
	});
}
function Switch({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch$1, {
		className: cn("peer inline-flex h-6 w-10 shrink-0 items-center rounded-full shadow-[var(--shadow-border)] transition-[background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted", className),
		...props,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchThumb, { className: "pointer-events-none block size-5 translate-x-0.5 rounded-full bg-background transition-transform duration-150 data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-primary-foreground" })
	});
}
function Textarea({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
		"data-slot": "textarea",
		className: cn("min-h-24 w-full rounded-md bg-card px-3 py-2 text-sm text-foreground shadow-[var(--shadow-border)] outline-none transition-[box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50", className),
		...props
	});
}
var SECTIONS = [
	{
		id: "connection",
		label: "Connection"
	},
	{
		id: "generation",
		label: "Generation"
	},
	{
		id: "appearance",
		label: "Appearance"
	},
	{
		id: "editor",
		label: "Editor"
	},
	{
		id: "system",
		label: "System"
	},
	{
		id: "data",
		label: "Data"
	}
];
function Field({ label, hint, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-baseline justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }), hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono text-xs tabular-nums text-muted-foreground",
				children: hint
			}) : null]
		}), children]
	});
}
function SettingsPanel({ models, onModels }) {
	const open = useStudio((s) => s.settingsOpen);
	const setOpen = useStudio((s) => s.setSettingsOpen);
	const section = useStudio((s) => s.settingsSection);
	const setSection = useStudio((s) => s.setSettingsSection);
	const settings = useStudio((s) => s.settings);
	const setSettings = useStudio((s) => s.setSettings);
	const resetSettings = useStudio((s) => s.resetSettings);
	const clearAll = useStudio((s) => s.clearAll);
	const conversations = useStudio((s) => s.conversations);
	const [testing, setTesting] = (0, import_react.useState)(false);
	async function testConnection() {
		setTesting(true);
		try {
			const list = await fetchModels();
			onModels(list);
			if (list[0] && !list.includes(settings.model)) setSettings({ model: list[0] });
			toast.success(`Connected · ${list.length} models`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Connection failed");
		} finally {
			setTesting(false);
		}
	}
	function exportJson() {
		const blob = new Blob([JSON.stringify({
			settings,
			conversations
		}, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "chat-studio.json";
		link.click();
		URL.revokeObjectURL(url);
	}
	const options = models;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open,
		onOpenChange: setOpen,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
			title: "Settings",
			className: "p-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] font-medium tracking-wider text-muted-foreground uppercase",
				children: "Settings"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-2xl tracking-tight",
				children: "Studio"
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-h-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "hidden w-36 shrink-0 flex-col gap-0.5 border-r border-border p-3 sm:flex",
					children: SECTIONS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setSection(item.id),
						className: cn("rounded-md px-2.5 py-2 text-left text-[13px] transition-colors", section === item.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"),
						children: item.label
					}, item.id))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ScrollArea, {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-2 overflow-x-auto px-5 pt-4 sm:hidden",
						children: SECTIONS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setSection(item.id),
							className: cn("shrink-0 rounded-full px-3 py-1.5 text-xs", section === item.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"),
							children: item.label
						}, item.id))
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-6 px-5 py-5 pb-10",
						children: [
							section === "connection" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-sm font-medium",
									children: "OpenAI-compatible API"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 text-sm text-muted-foreground",
									children: [
										"The endpoint and API key are configured on the server via the ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-mono",
											children: "OPENAI_BASE_URL"
										}),
										" and",
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-mono",
											children: "OPENAI_API_KEY"
										}),
										" env vars. Requests are proxied through this app's server, so the key never reaches the browser."
									]
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Model",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
											value: options.includes(settings.model) ? settings.model : "custom-model",
											onValueChange: (value) => {
												if (value !== "custom-model") setSettings({ model: value });
												else setSettings({ model: "" });
											},
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [options.map((model) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
												value: model,
												children: model
											}, model)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
												value: "custom-model",
												children: "Custom name…"
											})] })]
										}), !options.includes(settings.model) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											value: settings.model,
											onChange: (event) => setSettings({ model: event.target.value }),
											placeholder: "model-id"
										}) : null]
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									onClick: testConnection,
									disabled: testing,
									children: testing ? "Testing…" : "Test connection"
								})
							] }) : null,
							section === "generation" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Temperature",
									hint: settings.temperature.toFixed(2),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
										min: 0,
										max: 2,
										step: .05,
										value: [settings.temperature],
										onValueChange: ([temperature]) => setSettings({ temperature: temperature ?? .7 })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Max tokens",
									hint: String(settings.maxTokens),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
										min: 256,
										max: 4096,
										step: 64,
										value: [settings.maxTokens],
										onValueChange: ([maxTokens]) => setSettings({ maxTokens: maxTokens ?? 1024 })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Top P",
									hint: settings.topP.toFixed(2),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
										min: 0,
										max: 1,
										step: .05,
										value: [settings.topP],
										onValueChange: ([topP]) => setSettings({ topP: topP ?? 1 })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Frequency penalty",
									hint: settings.frequencyPenalty.toFixed(2),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
										min: 0,
										max: 2,
										step: .05,
										value: [settings.frequencyPenalty],
										onValueChange: ([frequencyPenalty]) => setSettings({ frequencyPenalty: frequencyPenalty ?? 0 })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Presence penalty",
									hint: settings.presencePenalty.toFixed(2),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
										min: 0,
										max: 2,
										step: .05,
										value: [settings.presencePenalty],
										onValueChange: ([presencePenalty]) => setSettings({ presencePenalty: presencePenalty ?? 0 })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between rounded-xl bg-muted/60 px-3 py-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-sm font-medium",
										children: "Streaming"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-xs text-muted-foreground",
										children: "Tokens appear as they generate"
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
										checked: settings.stream,
										onCheckedChange: (stream) => setSettings({ stream })
									})]
								})
							] }) : null,
							section === "appearance" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Theme",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
										value: settings.theme,
										onValueChange: (theme) => setSettings({ theme }),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
												value: "dark",
												children: "Dark"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
												value: "light",
												children: "Light"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
												value: "system",
												children: "System"
											})
										] })]
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Type size",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
										value: settings.fontSize,
										onValueChange: (fontSize) => setSettings({ fontSize }),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
												value: "sm",
												children: "Small"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
												value: "md",
												children: "Medium"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
												value: "lg",
												children: "Large"
											})
										] })]
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Density",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
										value: settings.density,
										onValueChange: (density) => setSettings({ density }),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
											value: "comfortable",
											children: "Comfortable"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
											value: "compact",
											children: "Compact"
										})] })]
									})
								})
							] }) : null,
							section === "editor" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between rounded-xl bg-muted/60 px-3 py-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm font-medium",
									children: "Enter to send"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs text-muted-foreground",
									children: "Shift + Enter always inserts a line"
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									checked: settings.sendWithEnter,
									onCheckedChange: (sendWithEnter) => setSettings({ sendWithEnter })
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between rounded-xl bg-muted/60 px-3 py-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm font-medium",
									children: "Render markdown"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs text-muted-foreground",
									children: "Format assistant replies"
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									checked: settings.showMarkdown,
									onCheckedChange: (showMarkdown) => setSettings({ showMarkdown })
								})]
							})] }) : null,
							section === "system" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Global system prompt",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
									value: settings.systemPromptOverride,
									onChange: (event) => setSettings({ systemPromptOverride: event.target.value }),
									placeholder: "Optional instructions added to every menu…",
									className: "min-h-36"
								})
							}) : null,
							section === "data" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-muted-foreground",
									children: "Drafts live in this browser. The API key lives only on the server and is never exposed to the browser."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											variant: "outline",
											onClick: exportJson,
											children: "Export drafts"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											variant: "outline",
											onClick: () => {
												clearAll();
												toast.success("Drafts cleared");
											},
											children: "Clear drafts"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											variant: "ghost",
											onClick: () => {
												resetSettings();
												toast.success("Settings reset");
											},
											children: "Reset settings"
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-xs text-muted-foreground",
									children: [
										"Defaults match ",
										DEFAULT_SETTINGS.model,
										", temperature ",
										DEFAULT_SETTINGS.temperature,
										"."
									]
								})
							] }) : null
						]
					})]
				})]
			})]
		})
	});
}
function Studio() {
	const setHydrated = useStudio((s) => s.setHydrated);
	const settings = useStudio((s) => s.settings);
	const modeId = useStudio((s) => s.modeId);
	const conversations = useStudio((s) => s.conversations);
	const activeId = useStudio((s) => s.activeId);
	const streamingId = useStudio((s) => s.streamingId);
	const sidebarOpen = useStudio((s) => s.sidebarOpen);
	const setSidebarOpen = useStudio((s) => s.setSidebarOpen);
	const newConversation = useStudio((s) => s.newConversation);
	const addMessage = useStudio((s) => s.addMessage);
	const patchMessage = useStudio((s) => s.patchMessage);
	const setStreamingId = useStudio((s) => s.setStreamingId);
	const setExtras = useStudio((s) => s.setExtras);
	const [draft, setDraft] = (0, import_react.useState)("");
	const [models, setModels] = (0, import_react.useState)([]);
	const [thinking, setThinking] = (0, import_react.useState)(false);
	const abortRef = (0, import_react.useRef)(null);
	const scrollerRef = (0, import_react.useRef)(null);
	const conversation = (0, import_react.useMemo)(() => conversations.find((item) => item.id === activeId) ?? null, [conversations, activeId]);
	const extras = conversation?.extras ?? defaultExtras(modeId);
	const messages = conversation?.messages ?? [];
	(0, import_react.useEffect)(() => {
		const unsub = useStudio.persist.onFinishHydration(() => setHydrated());
		if (useStudio.persist.hasHydrated()) setHydrated();
		return unsub;
	}, [setHydrated]);
	(0, import_react.useEffect)(() => {
		applyTheme(settings.theme);
		applyFontSize(settings.fontSize);
		applyDensity(settings.density);
		document.documentElement.dataset.sendEnter = settings.sendWithEnter ? "1" : "0";
	}, [
		settings.theme,
		settings.fontSize,
		settings.density,
		settings.sendWithEnter
	]);
	(0, import_react.useEffect)(() => {
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => {
			if (useStudio.getState().settings.theme === "system") applyTheme("system");
		};
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, []);
	(0, import_react.useEffect)(() => {
		const onKey = (event) => {
			if ((event.metaKey || event.ctrlKey) && event.key === ",") {
				event.preventDefault();
				useStudio.getState().setSettingsOpen(true);
			}
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n" && !event.shiftKey) {
				const target = event.target;
				if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
				event.preventDefault();
				newConversation();
				setDraft("");
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [newConversation]);
	(0, import_react.useEffect)(() => {
		const el = scrollerRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [
		messages,
		thinking,
		streamingId
	]);
	function stop() {
		abortRef.current?.abort();
		abortRef.current = null;
		setStreamingId(null);
		setThinking(false);
	}
	async function run(userText, prior) {
		const text = userText.trim();
		if (!text || useStudio.getState().streamingId) return;
		if (!useStudio.getState().settings.model.trim()) {
			useStudio.getState().setSettingsOpen(true);
			toast.error("Pilih model di Settings dulu.");
			return;
		}
		let id = useStudio.getState().activeId;
		if (!id) id = newConversation(modeId);
		const conv = useStudio.getState().conversations.find((item) => item.id === id) ?? null;
		if (!conv) return;
		const history = prior ?? conv.messages;
		const user = {
			id: uid(),
			role: "user",
			content: text,
			createdAt: Date.now()
		};
		const assistant = {
			id: uid(),
			role: "assistant",
			content: "",
			createdAt: Date.now()
		};
		addMessage(id, user);
		addMessage(id, assistant);
		setStreamingId(assistant.id);
		setThinking(false);
		setDraft("");
		const mode = MODE_BY_ID[conv.modeId];
		const extra = extrasInstruction(conv.modeId, conv.extras);
		const override = settings.systemPromptOverride.trim();
		const payloadMessages = [
			{
				role: "system",
				content: [
					mode.system,
					extra,
					override
				].filter(Boolean).join("\n\n")
			},
			...history.map((message) => ({
				role: message.role,
				content: message.content
			})),
			{
				role: "user",
				content: text
			}
		];
		const controller = new AbortController();
		abortRef.current = controller;
		let assembled = "";
		await generateStream({
			messages: payloadMessages,
			stream: settings.stream,
			connection: {
				provider: settings.provider,
				model: settings.model
			},
			params: {
				temperature: settings.temperature,
				maxTokens: settings.maxTokens,
				topP: settings.topP,
				frequencyPenalty: settings.frequencyPenalty,
				presencePenalty: settings.presencePenalty
			}
		}, {
			signal: controller.signal,
			onThinking: () => setThinking(true),
			onDelta: (chunk) => {
				assembled += chunk;
				setThinking(false);
				patchMessage(id, assistant.id, { content: assembled });
			},
			onDone: () => {
				setStreamingId(null);
				setThinking(false);
				abortRef.current = null;
			},
			onError: (message) => {
				patchMessage(id, assistant.id, {
					error: message,
					content: assembled
				});
				setStreamingId(null);
				setThinking(false);
				abortRef.current = null;
			}
		});
	}
	function regenerate() {
		if (!conversation) return;
		const lastUser = [...conversation.messages].reverse().find((item) => item.role === "user");
		if (!lastUser) return;
		const cut = conversation.messages.filter((item) => item.createdAt < lastUser.createdAt);
		useStudio.setState({ conversations: useStudio.getState().conversations.map((item) => item.id === conversation.id ? {
			...item,
			messages: cut
		} : item) });
		run(lastUser.content, cut);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-dvh overflow-hidden bg-background text-foreground",
		"data-density": settings.density,
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
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-h-0 min-w-0 flex-1 flex-col",
				style: { backgroundImage: "var(--canvas-wash)" },
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Header, { models }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						ref: scrollerRef,
						className: "min-h-0 flex-1 overflow-y-auto",
						children: messages.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
							modeId,
							onPick: (prompt) => void run(prompt)
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageList, {
							messages,
							streamingId,
							thinking,
							showMarkdown: settings.showMarkdown,
							onRegenerate: regenerate
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Composer, {
						modeId,
						extras,
						onExtras: (next) => {
							const id = conversation?.id ?? newConversation(modeId);
							setExtras(id, next);
						},
						value: draft,
						onChange: setDraft,
						onSubmit: () => void run(draft),
						onStop: stop,
						streaming: Boolean(streamingId)
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsPanel, {
				models,
				onModels: setModels
			})
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Studio, {});
}
//#endregion
export { Home as component };
