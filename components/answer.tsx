// A help answer, laid out like a how-to rather than printed as one block.
//
// The assistant writes a small, fixed subset of Markdown — paragraphs,
// numbered steps, bullets, and **bold** for the names of buttons and
// pages — and this turns it into real lists and real emphasis. It is
// deliberately not a Markdown library: no headings, tables, links or
// code, because an answer that needs those is not a help answer, and a
// renderer that accepts everything is a renderer you cannot trust with
// model output.
//
// Plain text with no markup still comes out as clean paragraphs, so the
// built-in guide reads the same way the assistant does.

import { Fragment, type ReactNode } from "react";

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "ul"; items: string[] };

const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  let open: Block | null = null;
  const close = () => {
    if (open) blocks.push(open);
    open = null;
  };

  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      close();
      continue;
    }
    const ol = ORDERED.exec(line);
    const ul = ol ? null : BULLET.exec(line);
    if (ol) {
      if (open?.kind !== "ol") {
        close();
        open = { kind: "ol", items: [] };
      }
      open.items.push(ol[1]);
    } else if (ul) {
      if (open?.kind !== "ul") {
        close();
        open = { kind: "ul", items: [] };
      }
      open.items.push(ul[1]);
    } else if (open?.kind === "ol" || open?.kind === "ul") {
      // a wrapped continuation of the step above, not a new paragraph
      open.items[open.items.length - 1] += " " + line.trim();
    } else {
      if (open?.kind !== "p") {
        close();
        open = { kind: "p", lines: [] };
      }
      open.lines.push(line.trim());
    }
  }
  close();
  return blocks;
}

/** **bold** only — the one inline mark the answers use. Stray asterisks
 *  that never close are shown as typed. */
function inline(s: string): ReactNode {
  const parts = s.split(/(\*\*[^*]+?\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-bold text-paper">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

export function Answer({ text }: { text: string }) {
  const blocks = parse(text);
  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((b, i) =>
        b.kind === "p" ? (
          <p key={i} className="leading-relaxed">
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        ) : b.kind === "ol" ? (
          <ol key={i} className="flex list-decimal flex-col gap-1.5 pl-5 marker:font-bold marker:text-mist">
            {b.items.map((it, j) => (
              <li key={j} className="pl-1 leading-relaxed">
                {inline(it)}
              </li>
            ))}
          </ol>
        ) : (
          <ul key={i} className="flex list-disc flex-col gap-1 pl-5 marker:text-mist">
            {b.items.map((it, j) => (
              <li key={j} className="pl-1 leading-relaxed">
                {inline(it)}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
