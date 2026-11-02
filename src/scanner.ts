// Pure tag scanner: no VS Code imports, so it can be unit tested with plain Node.

/** A span of characters on one line. `line` is relative to the first scanned line. */
export interface Span {
  line: number;
  start: number;
  end: number;
}

/** `<a>` is open, `</a>` is close, `<a/>` is selfClosing. */
export type TagKind = 'open' | 'close' | 'selfClosing';

export interface TagMatch {
  /** Full tag name including any namespace prefix, e.g. `soap:Body`. */
  name: string;
  kind: TagKind;
  nameSpan: Span;
  /** The `<` or `</` before the name. */
  openSpan: Span;
  /** The `>` or `/>` that ends the tag, if it was found inside the scanned text. */
  closeSpan?: Span;
  /** Attribute names inside the tag, e.g. `id` and `xmlns:ns`. Values are not included. */
  attributeSpans: Span[];
}

/** Lines longer than this are skipped, matching VS Code's own tokenization limit. */
export const DEFAULT_MAX_LINE_LENGTH = 20_000;

// One pass over the text. The first three alternatives consume comments, CDATA,
// and `<?...?>` / `<!...>` declarations so tags inside them are not colored.
// The last alternative is an element tag:
//   1: "/" for closing tags   2: tag name   3: attributes   4: ">" or "/>"
const NAME = String.raw`[\p{L}_][\p{L}\p{N}_.\-]*(?::[\p{L}_][\p{L}\p{N}_.\-]*)?`;
const TOKEN_RE = new RegExp(
  [
    String.raw`<!--[\s\S]*?(?:-->|$)`,
    String.raw`<!\[CDATA\[[\s\S]*?(?:\]\]>|$)`,
    String.raw`<[?!][\s\S]*?(?:>|$)`,
    String.raw`<(\/?)(${NAME})` + String.raw`((?:[^<>"'\/]|\/(?!>)|"[^"]*"|'[^']*')*)(\/?>)?`,
  ].join('|'),
  'gu',
);

// Runs over a tag's attribute text. Quoted values are consumed so words inside
// them are skipped; group 1 is an attribute name.
const ATTR_RE = new RegExp(String.raw`"[^"]*"|'[^']*'|(${NAME})`, 'gu');

/**
 * Finds every element tag in the given lines. Lines over `maxLineLength` are
 * treated as empty so a single huge line can't stall the editor.
 */
export function scanLines(lines: readonly string[], maxLineLength = DEFAULT_MAX_LINE_LENGTH): TagMatch[] {
  return scan(lines, { maxLineLength }).tags;
}

export interface ScanOptions {
  /** Report at most one safe line per this many lines. Default: none. */
  safeLineEvery?: number;
  maxLineLength?: number;
  /** Fill in `attributeSpans`. Turn off when only nesting matters. Default: true. */
  attributes?: boolean;
}

/** A line whose start is not inside a tag, comment, CDATA section, or declaration. */
export interface SafeLine {
  line: number;
  /** How many tags were found before this line. */
  tagsBefore: number;
}

export interface ScanResult {
  tags: TagMatch[];
  /** Places where a later scan can safely start. At most one per `safeLineEvery` lines. */
  safeLines: SafeLine[];
}

/** Like `scanLines`, but also reports safe lines to resume scanning from. */
export function scan(lines: readonly string[], options: ScanOptions = {}): ScanResult {
  const { safeLineEvery = Infinity, maxLineLength = DEFAULT_MAX_LINE_LENGTH, attributes = true } = options;
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

  const tags: TagMatch[] = [];
  const safeLines: SafeLine[] = [];
  let nextSafe = safeLineEvery; // line 0 is where this scan started, so it is not reported
  let prevEnd = 0;
  // Every line start in [prevEnd, upTo] lies between tokens.
  const collectSafeLines = (upTo: number) => {
    while (nextSafe < lines.length && lineStarts[nextSafe] <= upTo) {
      if (lineStarts[nextSafe] >= prevEnd) {
        safeLines.push({ line: nextSafe, tagsBefore: tags.length });
        nextSafe += safeLineEvery;
      } else {
        nextSafe++; // inside the previous token; try the next line
      }
    }
  };

  TOKEN_RE.lastIndex = 0;
  for (let m = TOKEN_RE.exec(text); m !== null; m = TOKEN_RE.exec(text)) {
    collectSafeLines(m.index);
    prevEnd = m.index + m[0].length;

    const name = m[2];
    if (name === undefined) {
      continue; // comment, CDATA, or declaration
    }
    const openStart = m.index;
    const openEnd = openStart + 1 + m[1].length;
    const nameEnd = openEnd + name.length;
    const match: TagMatch = {
      name,
      kind: m[1] ? 'close' : m[4] === '/>' ? 'selfClosing' : 'open',
      nameSpan: toSpan(openEnd, nameEnd),
      openSpan: toSpan(openStart, openEnd),
      attributeSpans: [],
    };
    const attrs = m[3];
    if (attributes && /\S/.test(attrs)) {
      ATTR_RE.lastIndex = 0;
      for (let a = ATTR_RE.exec(attrs); a !== null; a = ATTR_RE.exec(attrs)) {
        if (a[1] !== undefined) {
          const start = nameEnd + a.index;
          match.attributeSpans.push(toSpan(start, start + a[1].length));
        }
      }
    }
    if (m[4] !== undefined) {
      const closeEnd = openStart + m[0].length;
      match.closeSpan = toSpan(closeEnd - m[4].length, closeEnd);
    }
    tags.push(match);
  }
  collectSafeLines(text.length);
  return { tags, safeLines };
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
