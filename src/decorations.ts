import * as vscode from "vscode";
import { RainbowConfig } from "./config";
import { NestedTag } from "./nesting";
import { colorIndex } from "./palette";
import { Span } from "./scanner";
import { TagIndex } from "./tagIndex";

/** Extra lines scanned above and below the visible area so small scrolls look seamless. */
const BUFFER_LINES = 100;

/** Above this many unmatched tags, only the ones near the visible area are marked. */
const MAX_UNMATCHED_MARKS = 1000;

/** Language modes that follow HTML rules (void elements, script and style contents). */
const HTML_LANGUAGES: ReadonlySet<string> = new Set(["html"]);

/** Saved index for one document, valid for `version`. */
interface DocEntry {
    version: number;
    index: TagIndex;
}

/**
 * Owns the decoration types and paints an editor's visible range: tag colors
 * (one type per palette color, plus one per override color), the matching-tag
 * highlight, and marks on unmatched tags.
 */
export class TagDecorator implements vscode.Disposable {
    private paletteTypes: vscode.TextEditorDecorationType[] = [];
    private overrideTypes = new Map<string, vscode.TextEditorDecorationType>();
    private readonly matchType = vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor("rainbowXml.matchingTagBackground"),
        borderColor: new vscode.ThemeColor("rainbowXml.matchingTagBorder"),
        borderStyle: "solid",
        borderWidth: "1px",
    });
    private readonly unmatchedType = vscode.window.createTextEditorDecorationType({
        // Theme colors are available to CSS as variables, with dots turned into dashes.
        textDecoration: "underline wavy var(--vscode-rainbowXml-unmatchedTag)",
        overviewRulerColor: new vscode.ThemeColor("rainbowXml.unmatchedTag"),
        overviewRulerLane: vscode.OverviewRulerLane.Right,
    });
    private readonly docs = new Map<string, DocEntry>();

    constructor(private config: RainbowConfig) {
        this.createTypes();
    }

    /** Swaps in new settings. Old decoration types are disposed, which also clears them from editors. */
    setConfig(config: RainbowConfig): void {
        this.disposeTypes();
        this.config = config;
        this.createTypes();
    }

    /** Paints everything: tag colors, unmatched marks, and the matching-tag highlight. */
    paint(editor: vscode.TextEditor): void {
        const groups = new Map<vscode.TextEditorDecorationType, vscode.Range[]>();
        for (const type of this.colorTypes()) {
            groups.set(type, []);
        }

        const index = this.indexFor(editor.document);
        const windows = scanWindows(editor);
        for (const window of windows) {
            for (const tag of index.tagsIn(window.start, window.end, this.config.colorAttributes)) {
                const ranges = groups.get(this.typeFor(tag))!;
                ranges.push(toRange(tag.nameSpan));
                for (const span of tag.attributeSpans) {
                    ranges.push(toRange(span));
                }
                if (this.config.colorBrackets) {
                    ranges.push(toRange(tag.openSpan));
                    if (tag.closeSpan) {
                        ranges.push(toRange(tag.closeSpan));
                    }
                }
            }
        }

        // Set every type, including empty ones, so stale colors from a previous scroll position are cleared.
        for (const [type, ranges] of groups) {
            editor.setDecorations(type, ranges);
        }
        this.paintUnmatched(editor, index, windows);
        this.paintMatch(editor);
    }

    /** Highlights the tag under each cursor and its partner. Cheap enough to run on every cursor move. */
    paintMatch(editor: vscode.TextEditor): void {
        const ranges: vscode.Range[] = [];
        if (this.config.highlightMatchingTag) {
            const index = this.indexFor(editor.document);
            for (const selection of editor.selections.slice(0, 10)) {
                const pair = index.matchAt(selection.active.line, selection.active.character);
                if (pair) {
                    ranges.push(toRange(pair.tag), toRange(pair.partner));
                }
            }
        }
        editor.setDecorations(this.matchType, ranges);
    }

    clear(editor: vscode.TextEditor): void {
        for (const type of [...this.colorTypes(), this.matchType, this.unmatchedType]) {
            editor.setDecorations(type, []);
        }
    }

    /** Drops saved nesting state at and below the first edited line. */
    documentChanged(e: vscode.TextDocumentChangeEvent): void {
        const key = e.document.uri.toString();
        const entry = this.docs.get(key);
        if (!entry || e.contentChanges.length === 0) {
            return;
        }
        if (entry.version !== e.document.version - 1) {
            this.docs.delete(key); // missed an edit; rescan from the top
            return;
        }
        entry.index.invalidateFrom(Math.min(...e.contentChanges.map((c) => c.range.start.line)));
        entry.version = e.document.version;
    }

    documentClosed(doc: vscode.TextDocument): void {
        this.docs.delete(doc.uri.toString());
    }

    dispose(): void {
        this.disposeTypes();
        this.matchType.dispose();
        this.unmatchedType.dispose();
    }

    private paintUnmatched(
        editor: vscode.TextEditor,
        index: TagIndex,
        windows: LineWindow[],
    ): void {
        const marks: vscode.DecorationOptions[] = [];
        if (this.config.markUnmatchedTags) {
            let unmatched = index.unmatched();
            if (unmatched.length > MAX_UNMATCHED_MARKS) {
                unmatched = unmatched.filter((u) =>
                    windows.some((w) => u.at.line >= w.start && u.at.line <= w.end),
                );
            }
            for (const u of unmatched) {
                marks.push({
                    range: toRange(u.at),
                    hoverMessage:
                        u.kind === "stray"
                            ? `Rainbow XML: \`</${u.name}>\` has no opening tag`
                            : `Rainbow XML: \`<${u.name}>\` is never closed`,
                });
            }
        }
        editor.setDecorations(this.unmatchedType, marks);
    }

    private indexFor(doc: vscode.TextDocument): TagIndex {
        const key = doc.uri.toString();
        const html = HTML_LANGUAGES.has(doc.languageId);
        let entry = this.docs.get(key);
        if (!entry || entry.version !== doc.version || entry.index.html !== html) {
            const src = {
                get lineCount() {
                    return doc.lineCount;
                },
                lineAt: (line: number) => doc.lineAt(line).text,
            };
            entry = { version: doc.version, index: new TagIndex(src, html) };
            this.docs.set(key, entry);
        }
        return entry.index;
    }

    private typeFor(tag: NestedTag): vscode.TextEditorDecorationType {
        const override = this.config.overrides.get(tag.name);
        if (override !== undefined) {
            return this.overrideTypes.get(override)!;
        }
        const n = this.paletteTypes.length;
        return this.paletteTypes[
            this.config.colorBy === "name" ? colorIndex(tag.key, n) : tag.depth % n
        ];
    }

    private createTypes(): void {
        this.paletteTypes = this.config.palette.map((color) =>
            vscode.window.createTextEditorDecorationType({ color }),
        );
        for (const color of new Set(this.config.overrides.values())) {
            this.overrideTypes.set(color, vscode.window.createTextEditorDecorationType({ color }));
        }
    }

    private disposeTypes(): void {
        for (const type of this.colorTypes()) {
            type.dispose();
        }
        this.paletteTypes = [];
        this.overrideTypes.clear();
    }

    private colorTypes(): vscode.TextEditorDecorationType[] {
        return [...this.paletteTypes, ...this.overrideTypes.values()];
    }
}

function toRange(s: Span): vscode.Range {
    return new vscode.Range(s.line, s.start, s.line, s.end);
}

interface LineWindow {
    start: number;
    end: number;
}

/**
 * The line ranges to scan: each visible range plus a buffer, with overlapping
 * windows merged. Folded regions stay unscanned because they are not visible.
 */
function scanWindows(editor: vscode.TextEditor): LineWindow[] {
    const lastLine = editor.document.lineCount - 1;
    const windows = editor.visibleRanges
        .map((r) => ({
            start: Math.max(0, r.start.line - BUFFER_LINES),
            end: Math.min(lastLine, r.end.line + BUFFER_LINES),
        }))
        .sort((a, b) => a.start - b.start);

    const merged: LineWindow[] = [];
    for (const w of windows) {
        const prev = merged[merged.length - 1];
        if (prev && w.start <= prev.end + 1) {
            prev.end = Math.max(prev.end, w.end);
        } else {
            merged.push({ ...w });
        }
    }
    return merged;
}
