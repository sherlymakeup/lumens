import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import sql from "highlight.js/lib/languages/sql";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import java from "highlight.js/lib/languages/java";
import php from "highlight.js/lib/languages/php";
import csharp from "highlight.js/lib/languages/csharp";
import cpp from "highlight.js/lib/languages/cpp";

hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("java", java);
hljs.registerLanguage("php", php);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("cpp", cpp);

// Aliases that models commonly emit in fences
const ALIASES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  jsx: "javascript",
  tsx: "typescript",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  html: "xml",
  vue: "xml",
  "c#": "csharp",
  "c++": "cpp",
  yml: "yaml",
  md: "markdown",
};

const ESC: Record<string, string> = {
  "&": "\u0026amp;",
  "<": "\u0026lt;",
  ">": "\u0026gt;",
  '"': "\u0026quot;",
};

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (ch) => ESC[ch] ?? ch);
}

/** Highlight a code block. Falls back to escaped plaintext for unknown languages. */
export function highlightCode(code: string, lang: string): string {
  const normalized = ALIASES[lang.toLowerCase()] ?? lang.toLowerCase();
  if (normalized && hljs.getLanguage(normalized)) {
    try {
      return hljs.highlight(code, { language: normalized }).value;
    } catch {
      /* fall through to plaintext */
    }
  }
  return escapeHtml(code);
}
