import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { highlightCode } from "./highlight";
import { tryParseTable } from "./table-parse";
import { cn } from "./utils";

const ESC: Record<string, string> = {
  "&": "\u0026amp;",
  "<": "\u0026lt;",
  ">": "\u0026gt;",
  '"': "\u0026quot;",
};

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (ch) => ESC[ch] ?? ch);
}

function inlineToHtml(text: string) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, '<code class="md-icode">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^\w])\*([^*]+)\*(?!\w)/g, "$1<em>$2</em>");
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>',
  );
  // Fallback: sandbox:// links ditulis agent sebagai markdown — render sebagai
  // kartu file visual (bukan link rusak). Agent seharusnya pakai read_file tool.
  html = html.replace(
    /\[([^\]]+)\]\(sandbox:\/\/([^\s)]+)\)/g,
    (_m, label: string, path: string) => {
      const filename = path.split("/").pop() ?? path;
      return `<span class="md-sandbox-file" data-path="${escapeHtml(path)}"><span class="md-sandbox-file-icon">📄</span><span class="md-sandbox-file-name">${escapeHtml(filename)}</span><span class="md-sandbox-file-hint">${escapeHtml(label)}</span></span>`;
    },
  );
  return html;
}

type Block =
  | { type: "code"; lang: string; body: string }
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "hr" }
  | { type: "p"; text: string };

function parseBlocks(source: string): Block[] {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]?.startsWith("```")) {
        body.push(lines[i] ?? "");
        i += 1;
      }
      blocks.push({ type: "code", lang, body: body.join("\n") });
      i += 1;
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }
    const table = tryParseTable(lines, i);
    if (table) {
      blocks.push({ type: "table", headers: table.block.headers, rows: table.block.rows });
      i = table.next;
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      });
      i += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      const quote: string[] = [];
      while (i < lines.length && (lines[i]?.startsWith("> ") || lines[i] === ">")) {
        quote.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "quote", text: quote.join("\n") });
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (
        i < lines.length &&
        (ordered ? /^\s*\d+\.\s+/.test(lines[i] ?? "") : /^\s*[-*]\s+/.test(lines[i] ?? ""))
      ) {
        items.push((lines[i] ?? "").replace(/^\s*(?:[-*]|\d+\.)\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && (lines[i] ?? "").trim() !== "" && !isFenceOrBlock(lines[i] ?? "")) {
      para.push(lines[i] ?? "");
      i += 1;
    }
    blocks.push({ type: "p", text: para.join("\n") });
  }
  return blocks;
}

function isFenceOrBlock(line: string) {
  return (
    line.startsWith("```") ||
    /^#{1,3}\s+/.test(line) ||
    line.startsWith("> ") ||
    /^\s*[-*]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^\s*\|/.test(line) ||
    /^---+$/.test(line.trim())
  );
}

function CodeBlock({
  lang,
  body,
  copyLabel,
}: {
  lang: string;
  body: string;
  copyLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const html = useMemo(() => highlightCode(body, lang), [body, lang]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <pre className="md-pre">
      <div className="md-pre-head">
        {lang ? <span className="md-lang">{lang}</span> : <span />}
        <button
          type="button"
          className="md-copy-btn"
          title={copyLabel}
          aria-label={copyLabel}
          onClick={() => void copy()}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}

export function Markdown({
  content,
  className,
  copyLabel = "Copy",
}: {
  content: string;
  className?: string;
  copyLabel?: string;
}) {
  const blocks = parseBlocks(content);
  return (
    <div className={cn("md-body", className)}>
      {blocks.map((block, index) => {
        if (block.type === "code") {
          return <CodeBlock key={index} lang={block.lang} body={block.body} copyLabel={copyLabel} />;
        }
        if (block.type === "heading") {
          const Tag = (`h${block.level}` as unknown) as "h1";
          return (
            <Tag
              key={index}
              className={cn(
                "text-balance",
                block.level === 1 && "md-h1",
                block.level === 2 && "md-h2",
                block.level === 3 && "md-h3",
              )}
              dangerouslySetInnerHTML={{ __html: inlineToHtml(block.text) }}
            />
          );
        }
        if (block.type === "quote") {
          return (
            <blockquote
              key={index}
              className="md-quote"
              dangerouslySetInnerHTML={{ __html: inlineToHtml(block.text) }}
            />
          );
        }
        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag key={index} className={block.ordered ? "md-ol" : "md-ul"}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} dangerouslySetInnerHTML={{ __html: inlineToHtml(item) }} />
              ))}
            </Tag>
          );
        }
        if (block.type === "hr") {
          return <hr key={index} className="md-hr" />;
        }
        if (block.type === "table") {
          return (
            <div key={index} className="md-table-wrap">
              <table className="md-table">
                <thead>
                  <tr>
                    {block.headers.map((header, headerIndex) => (
                      <th
                        key={headerIndex}
                        dangerouslySetInnerHTML={{ __html: inlineToHtml(header) }}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          dangerouslySetInnerHTML={{ __html: inlineToHtml(cell) }}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <p
            key={index}
            className="md-p"
            dangerouslySetInnerHTML={{ __html: inlineToHtml(block.text) }}
          />
        );
      })}
    </div>
  );
}
