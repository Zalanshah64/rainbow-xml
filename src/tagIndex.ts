// Pure document index: no VS Code imports, so it can be unit tested with plain Node.
import { Checkpoint, NestedTag, NestOptions, scanNested, Unmatched } from "./nesting";
import { Span } from "./scanner";

/** Read access to a document's lines. */
export interface LineSource {
    readonly lineCount: number;
    lineAt(line: number): string;
}

/** How often to save the nesting state, so no scan has to start from the top. */
export const CHECKPOINT_EVERY = 256;

/** A tag under the cursor and the tag it pairs with, as name spans in document lines. */
export interface TagPair {
    tag: Span;
    partner: Span;
}

/**
 * Whole-document nesting information for one document. The first query scans
 * the whole file, saving the open elements about every 256 lines. After an
 * edit, `invalidateFrom` drops what's below it and only that part is rescanned.
 */
export class TagIndex {
    /** Sorted by line; the first is always line 0 with nothing open. */
    private checkpoints: Checkpoint[] = [{ line: 0, stack: [], min: 0 }];
    private unmatchedTags: Unmatched[] = [];
    /** False when lines after the last checkpoint still need scanning. */
    private complete = false;

    constructor(
        private readonly src: LineSource,
        readonly html = false,
        private readonly checkpointEvery = CHECKPOINT_EVERY,
    ) {}

    /** Call after an edit whose first changed line is `line`. */
    invalidateFrom(line: number): void {
        // A checkpoint only depends on the text above it. Line 0 is always valid.
        this.checkpoints = this.checkpoints.filter((c) => c.line < Math.max(1, line));
        this.complete = false;
    }

    /** Opening tags that are never closed and closing tags with nothing to close. */
    unmatched(): readonly Unmatched[] {
        this.update();
        return this.unmatchedTags;
    }

    /**
     * Tags whose names are on lines `start` through `end`, with their depths.
     * Spans are in document lines.
     */
    tagsIn(start: number, end: number, attributes = true): NestedTag[] {
        this.update();
        const from = this.checkpoints[this.segmentAt(start)];
        return this.scanFrom(from, end + 1, { attributes }).filter((t) => t.nameSpan.line >= start);
    }

    /**
     * If `character` on `line` is on a tag's `<` or name, returns that tag and
     * its partner: the closing tag for an opening tag, or the other way around.
     */
    matchAt(line: number, character: number): TagPair | undefined {
        this.update();
        const k = this.segmentAt(line);
        const tags = this.scanSegment(k);
        const i = tags.findIndex(
            (t) =>
                t.nameSpan.line === line &&
                t.openSpan.start <= character &&
                character <= t.nameSpan.end,
        );
        if (i === -1) {
            return undefined;
        }
        const tag = tags[i];
        if (tag.kind === "close") {
            return tag.openedAt && { tag: tag.nameSpan, partner: tag.openedAt };
        }
        if (tag.kind !== "open") {
            return undefined;
        }

        // The first closing tag that ends this element (or something around it)
        // decides: if it closes this exact element, that's the partner.
        const depth = tag.depth;
        const pairFrom = (later: NestedTag[]): TagPair | undefined | null => {
            const end = later.find(
                (t) => t.kind === "close" && t.openedAt !== undefined && t.depth <= depth,
            );
            if (!end) {
                return null; // not decided in these tags
            }
            return sameSpan(end.openedAt!, tag.nameSpan)
                ? { tag: tag.nameSpan, partner: end.nameSpan }
                : undefined;
        };
        const here = pairFrom(tags.slice(i + 1));
        if (here !== null) {
            return here;
        }
        // Skip whole segments where nesting never gets shallow enough to close this element.
        for (let n = k + 1; n < this.checkpoints.length; n++) {
            if (this.checkpoints[n].min <= depth) {
                return pairFrom(this.scanSegment(n)) ?? undefined;
            }
        }
        return undefined; // still open at the end of the file
    }

    /** Scans whatever is out of date, from the last checkpoint to the end. */
    private update(): void {
        if (this.complete) {
            return;
        }
        const last = this.checkpoints.pop()!;
        this.unmatchedTags = this.unmatchedTags.filter((u) => u.foundAt < last.line);
        const result = scanNested(readLines(this.src, last.line, this.src.lineCount), last.stack, {
            safeLineEvery: this.checkpointEvery,
            attributes: false,
            html: this.html,
            firstLine: last.line,
            atEnd: true,
        });
        this.checkpoints.push(...result.checkpoints);
        this.unmatchedTags.push(...result.unmatched);
        this.complete = true;
    }

    /** Index of the last checkpoint at or before `line`. */
    private segmentAt(line: number): number {
        let lo = 0;
        let hi = this.checkpoints.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (this.checkpoints[mid].line <= line) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }
        return lo;
    }

    /** The tags between checkpoint `k` and the next one. */
    private scanSegment(k: number): NestedTag[] {
        const end =
            k + 1 < this.checkpoints.length ? this.checkpoints[k + 1].line : this.src.lineCount;
        return this.scanFrom(this.checkpoints[k], end, { attributes: false });
    }

    /** Scans from a checkpoint up to (not including) line `end`, with spans in document lines. */
    private scanFrom(from: Checkpoint, end: number, options: NestOptions): NestedTag[] {
        const { tags } = scanNested(readLines(this.src, from.line, end), from.stack, {
            ...options,
            html: this.html,
            firstLine: from.line,
        });
        return tags.map((t) => toDocumentLines(t, from.line));
    }
}

function readLines(src: LineSource, start: number, end: number): string[] {
    const count = Math.max(0, Math.min(end, src.lineCount) - start);
    const lines: string[] = new Array(count);
    for (let i = 0; i < count; i++) {
        lines[i] = src.lineAt(start + i);
    }
    return lines;
}

function sameSpan(a: Span, b: Span): boolean {
    return a.line === b.line && a.start === b.start && a.end === b.end;
}

function toDocumentLines(tag: NestedTag, offset: number): NestedTag {
    if (offset === 0) {
        return tag;
    }
    const shift = (s: Span): Span => ({ line: s.line + offset, start: s.start, end: s.end });
    return {
        ...tag,
        nameSpan: shift(tag.nameSpan),
        openSpan: shift(tag.openSpan),
        closeSpan: tag.closeSpan && shift(tag.closeSpan),
        attributeSpans: tag.attributeSpans.map(shift),
    };
}
