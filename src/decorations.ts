import * as vscode from 'vscode';
import { RainbowConfig } from './config';
import { Checkpoint, scanNested } from './nesting';
import { Span } from './scanner';

/** Extra lines scanned above and below the visible area so small scrolls look seamless. */
const BUFFER_LINES = 100;

/** How often to save the nesting state, so painting never has to scan from the top. */
const CHECKPOINT_EVERY = 256;

/** Saved nesting state for one document, valid for `version`. */
interface DocNesting {
  version: number;
  /** Sorted by line; the first is always line 0 with nothing open. */
  checkpoints: Checkpoint[];
  /** False when lines after the last checkpoint still need scanning. */
  complete: boolean;
}

/**
 * Owns the decoration types (one per palette color, plus one per override color)
 * and paints tag names in an editor's visible range. A tag's color comes from
 * its nesting depth: the root is the first palette color, its children the
 * second, and so on, wrapping around.
 */
export class TagDecorator implements vscode.Disposable {
  private paletteTypes: vscode.TextEditorDecorationType[] = [];
  private overrideTypes = new Map<string, vscode.TextEditorDecorationType>();
  private readonly nesting = new Map<string, DocNesting>();

  constructor(private config: RainbowConfig) {
    this.createTypes();
  }

  /** Swaps in new settings. Old decoration types are disposed, which also clears them from editors. */
  setConfig(config: RainbowConfig): void {
    this.disposeTypes();
    this.config = config;
    this.createTypes();
  }

  paint(editor: vscode.TextEditor): void {
    const groups = new Map<vscode.TextEditorDecorationType, vscode.Range[]>();
    for (const type of this.allTypes()) {
      groups.set(type, []);
    }

    const doc = editor.document;
    const checkpoints = this.checkpointsFor(doc);
    for (const window of scanWindows(editor)) {
      // Start from the last checkpoint at or above the window so depths are known.
      const from = lastAtOrBefore(checkpoints, window.start);
      const toRange = (s: Span) => new vscode.Range(from.line + s.line, s.start, from.line + s.line, s.end);

      for (const tag of scanNested(readLines(doc, from.line, window.end), from.stack).tags) {
        if (from.line + tag.nameSpan.line < window.start) {
          continue;
        }
        const ranges = groups.get(this.typeFor(tag.name, tag.depth))!;
        ranges.push(toRange(tag.nameSpan));
        if (this.config.colorAttributes) {
          for (const span of tag.attributeSpans) {
            ranges.push(toRange(span));
          }
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
  }

  clear(editor: vscode.TextEditor): void {
    for (const type of this.allTypes()) {
      editor.setDecorations(type, []);
    }
  }

  /** Drops saved nesting state at and below the first edited line. */
  documentChanged(e: vscode.TextDocumentChangeEvent): void {
    const entry = this.nesting.get(e.document.uri.toString());
    if (!entry || e.contentChanges.length === 0) {
      return;
    }
    if (entry.version !== e.document.version - 1) {
      this.nesting.delete(e.document.uri.toString()); // missed an edit; rescan from the top
      return;
    }
    const firstLine = Math.min(...e.contentChanges.map((c) => c.range.start.line));
    // A checkpoint only depends on the text above it. Line 0 is always valid.
    entry.checkpoints = entry.checkpoints.filter((c) => c.line < Math.max(1, firstLine));
    entry.complete = false;
    entry.version = e.document.version;
  }

  documentClosed(doc: vscode.TextDocument): void {
    this.nesting.delete(doc.uri.toString());
  }

  dispose(): void {
    this.disposeTypes();
  }

  /**
   * Checkpoints covering the whole document. The first call scans everything;
   * after an edit, only the lines from the edit down are scanned again.
   */
  private checkpointsFor(doc: vscode.TextDocument): Checkpoint[] {
    const key = doc.uri.toString();
    let entry = this.nesting.get(key);
    if (!entry || entry.version !== doc.version) {
      entry = { version: doc.version, checkpoints: [{ line: 0, stack: [] }], complete: false };
      this.nesting.set(key, entry);
    }
    if (!entry.complete) {
      const last = entry.checkpoints[entry.checkpoints.length - 1];
      const lines = readLines(doc, last.line, doc.lineCount - 1);
      const options = { safeLineEvery: CHECKPOINT_EVERY, attributes: false };
      for (const c of scanNested(lines, last.stack, options).checkpoints) {
        entry.checkpoints.push({ line: last.line + c.line, stack: c.stack });
      }
      entry.complete = true;
    }
    return entry.checkpoints;
  }

  private typeFor(name: string, depth: number): vscode.TextEditorDecorationType {
    const override = this.config.overrides.get(name);
    if (override !== undefined) {
      return this.overrideTypes.get(override)!;
    }
    return this.paletteTypes[depth % this.paletteTypes.length];
  }

  private createTypes(): void {
    this.paletteTypes = this.config.palette.map((c) =>
      vscode.window.createTextEditorDecorationType({
        light: { color: c.light },
        dark: { color: c.dark },
      }),
    );
    for (const color of new Set(this.config.overrides.values())) {
      this.overrideTypes.set(color, vscode.window.createTextEditorDecorationType({ color }));
    }
  }

  private disposeTypes(): void {
    for (const type of this.allTypes()) {
      type.dispose();
    }
    this.paletteTypes = [];
    this.overrideTypes.clear();
  }

  private allTypes(): vscode.TextEditorDecorationType[] {
    return [...this.paletteTypes, ...this.overrideTypes.values()];
  }
}

function readLines(doc: vscode.TextDocument, start: number, end: number): string[] {
  const lines: string[] = new Array(end - start + 1);
  for (let i = start; i <= end; i++) {
    lines[i - start] = doc.lineAt(i).text;
  }
  return lines;
}

/** The last checkpoint at or before `line` (checkpoints are sorted, and the first is line 0). */
function lastAtOrBefore(checkpoints: readonly Checkpoint[], line: number): Checkpoint {
  let lo = 0;
  let hi = checkpoints.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (checkpoints[mid].line <= line) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return checkpoints[lo];
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
