// Pure nesting logic: no VS Code imports, so it can be unit tested with plain Node.
import { scan, ScanOptions, Span, TagMatch } from "./scanner";

/** An element whose opening tag has been seen but not its closing tag. */
export interface OpenElement {
    /** Name used to match closing tags (lowercased in HTML). */
    key: string;
    /** Where the opening tag's name is, in document lines. */
    at: Span;
}

export interface NestedTag extends TagMatch {
    /** How many elements this tag sits inside. The root element is 0. */
    depth: number;
    /** Name used for matching and for name-based colors (lowercased in HTML). */
    key: string;
    /** For a closing tag: where the opening tag it closes is, in document lines. */
    openedAt?: Span;
}

/** The open elements at the start of a line, outermost first. */
export interface Checkpoint {
    line: number;
    stack: readonly OpenElement[];
    /** The fewest elements open at any point from this checkpoint up to the next one. */
    min: number;
}

/** An opening tag that is never closed, or a closing tag with nothing to close. */
export interface Unmatched {
    kind: "unclosed" | "stray";
    name: string;
    /** Where the tag's name is, in document lines. */
    at: Span;
    /** The line where the scan found out. Results from that line on are redone after an edit there. */
    foundAt: number;
}

/** Tracks which elements are open while walking tags in document order. */
export class Nesting {
    private readonly stack: OpenElement[];
    /** The fewest elements open since the last `resetMin`. */
    min: number;
    readonly unmatched: Unmatched[] = [];

    constructor(stack: readonly OpenElement[] = []) {
        this.stack = [...stack];
        this.min = stack.length;
    }

    snapshot(): readonly OpenElement[] {
        return [...this.stack];
    }

    resetMin(): void {
        this.min = this.stack.length;
    }

    /**
     * Updates the open elements for this tag and returns its depth.
     * `at` is the tag's name span in document lines.
     */
    enter(tag: TagMatch, key: string, at: Span): { depth: number; openedAt?: Span } {
        switch (tag.kind) {
            case "open":
                this.stack.push({ key, at });
                return { depth: this.stack.length - 1 };
            case "selfClosing":
                return { depth: this.stack.length };
            case "close": {
                // Close back to the nearest element with this name, so one unclosed
                // tag doesn't shift every color after it.
                let i = this.stack.length - 1;
                while (i >= 0 && this.stack[i].key !== key) {
                    i--;
                }
                if (i === -1) {
                    this.unmatched.push({ kind: "stray", name: tag.name, at, foundAt: at.line });
                    return { depth: Math.max(0, this.stack.length - 1) }; // leave the stack alone
                }
                for (let j = i + 1; j < this.stack.length; j++) {
                    this.unmatched.push({
                        kind: "unclosed",
                        name: this.stack[j].key,
                        at: this.stack[j].at,
                        foundAt: at.line,
                    });
                }
                const openedAt = this.stack[i].at;
                this.stack.length = i;
                this.min = Math.min(this.min, i);
                return { depth: i, openedAt };
            }
        }
    }

    /** Marks every element still open as unclosed. Call at the end of the document. */
    finish(lastLine: number): void {
        for (const el of this.stack) {
            this.unmatched.push({ kind: "unclosed", name: el.key, at: el.at, foundAt: lastLine });
        }
    }
}

export interface NestOptions extends ScanOptions {
    /** Document line of `lines[0]`. Positions saved in open elements use document lines. Default: 0. */
    firstLine?: number;
    /** Treat the scanned lines as the end of the document, so leftover open elements are unclosed. */
    atEnd?: boolean;
}

export interface NestResult {
    /** Every tag found, with spans relative to `lines` like `scan`. */
    tags: NestedTag[];
    /**
     * Places a later scan can resume from, in document lines. The first is
     * always `firstLine` with `startStack`; the rest are about `safeLineEvery` apart.
     */
    checkpoints: Checkpoint[];
    unmatched: Unmatched[];
}

/**
 * Scans lines starting from a known set of open elements and works out each
 * tag's depth, where scans can resume, and which tags have no partner.
 */
export function scanNested(
    lines: readonly string[],
    startStack: readonly OpenElement[] = [],
    options: NestOptions = {},
): NestResult {
    const { firstLine = 0, atEnd = false } = options;
    const { tags, safeLines } = scan(lines, options);
    const nesting = new Nesting(startStack);
    const nested: NestedTag[] = new Array(tags.length);
    const checkpoints: Checkpoint[] = [
        { line: firstLine, stack: startStack, min: startStack.length },
    ];
    let s = 0;
    for (let i = 0; i <= tags.length; i++) {
        for (; s < safeLines.length && safeLines[s].tagsBefore === i; s++) {
            checkpoints[checkpoints.length - 1].min = nesting.min;
            nesting.resetMin();
            checkpoints.push({
                line: firstLine + safeLines[s].line,
                stack: nesting.snapshot(),
                min: nesting.min,
            });
        }
        if (i < tags.length) {
            const tag = tags[i];
            const key = options.html ? tag.name.toLowerCase() : tag.name;
            const at = { ...tag.nameSpan, line: firstLine + tag.nameSpan.line };
            const { depth, openedAt } = nesting.enter(tag, key, at);
            nested[i] = openedAt ? { ...tag, depth, key, openedAt } : { ...tag, depth, key };
        }
    }
    checkpoints[checkpoints.length - 1].min = nesting.min;
    if (atEnd) {
        nesting.finish(firstLine + lines.length);
    }
    return { tags: nested, checkpoints, unmatched: nesting.unmatched };
}
