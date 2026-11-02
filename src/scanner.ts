// Pure tag scanner: no VS Code imports, so it can be unit tested with plain Node.

/** A span of characters on one line. `line` is relative to the first scanned line. */
export interface Span {
  line: number;
  start: number;
  end: number;
}

export interface TagMatch {
  /** Full tag name including any namespace prefix, e.g. `soap:Body`. */
  name: string;
  nameSpan: Span;
  /** The `<` or `</` before the name. */
  openSpan: Span;
  /** The `>` or `/>` that ends the tag, if it was found inside the scanned text. */
  closeSpan?: Span;
}

/** Lines longer than this are skipped, matching VS Code's own tokenization limit. */
export const DEFAULT_MAX_LINE_LENGTH = 20_000;

// One pass over the text. The first three alternatives consume comments, CDATA,
// and `<?...?>` / `<!...>` declarations so tags inside them are not colored.
// The last alternative is an element tag:
//   1: "/" for closing tags   2: tag name   3: attributes   4: ">" or "/>"
const TOKEN_RE = new RegExp(
  [
    String.raw`<!--[\s\S]*?(?:-->|$)`,
    String.raw`<!\[CDATA\[[\s\S]*?(?:\]\]>|$)`,
    String.raw`<[?!][\s\S]*?(?:>|$)`,
    String.raw`<(\/?)([\p{L}_][\p{L}\p{N}_.\-]*(?::[\p{L}_][\p{L}\p{N}_.\-]*)?)` +
      String.raw`((?:[^<>"'\/]|\/(?!>)|"[^"]*"|'[^']*')*)(\/?>)?`,
  ].join('|'),
  'gu',
);

/**
 * Finds every element tag in the given lines. Lines over `maxLineLength` are
 * treated as empty so a single huge line can't stall the editor.
 */
export function scanLines(lines: readonly string[], maxLineLength = DEFAULT_MAX_LINE_LENGTH): TagMatch[] {
  const lineStarts: number[] = new Array(lines.length);
  const parts: string[] = new Array(lines.length);
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].length > maxLineLength ? '' : lines[i];
    lineStarts[i] = offset;
    parts[i] = line;
    offset += line.length + 1; // +1 for the joining "\n"
  }
  const text = parts.join('\n');

  const toSpan = (start: number, end: number): Span => {
    const line = lineAt(lineStarts, start);
    return { line, start: start - lineStarts[line], end: end - lineStarts[line] };
  };

  const matches: TagMatch[] = [];
  TOKEN_RE.lastIndex = 0;
  for (let m = TOKEN_RE.exec(text); m !== null; m = TOKEN_RE.exec(text)) {
    const name = m[2];
    if (name === undefined) {
      continue; // comment, CDATA, or declaration
    }
    const openStart = m.index;
    const openEnd = openStart + 1 + m[1].length;
    const nameEnd = openEnd + name.length;
    const match: TagMatch = {
      name,
      nameSpan: toSpan(openEnd, nameEnd),
      openSpan: toSpan(openStart, openEnd),
    };
    if (m[4] !== undefined) {
      const closeEnd = openStart + m[0].length;
      match.closeSpan = toSpan(closeEnd - m[4].length, closeEnd);
    }
    matches.push(match);
  }
  return matches;
}

/** Binary search for the line containing `offset`. */
function lineAt(lineStarts: readonly number[], offset: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= offset) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}
