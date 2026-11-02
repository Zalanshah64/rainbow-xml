import * as vscode from 'vscode';
import { RainbowConfig } from './config';
import { colorIndex } from './palette';
import { scanLines, Span } from './scanner';

/** Extra lines scanned above and below the visible area so small scrolls look seamless. */
const BUFFER_LINES = 100;

/**
 * Owns the decoration types (one per palette color, plus one per override color)
 * and paints tag names in an editor's visible range.
 */
export class TagDecorator implements vscode.Disposable {
  private paletteTypes: vscode.TextEditorDecorationType[] = [];
  private overrideTypes = new Map<string, vscode.TextEditorDecorationType>();

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
    for (const window of scanWindows(editor)) {
      const lines: string[] = [];
      for (let i = window.start; i <= window.end; i++) {
        lines.push(doc.lineAt(i).text);
      }
      const toRange = (s: Span) => new vscode.Range(window.start + s.line, s.start, window.start + s.line, s.end);

      for (const tag of scanLines(lines)) {
        const ranges = groups.get(this.typeFor(tag.name))!;
        ranges.push(toRange(tag.nameSpan));
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

  dispose(): void {
    this.disposeTypes();
  }

  private typeFor(name: string): vscode.TextEditorDecorationType {
    const override = this.config.overrides.get(name);
    if (override !== undefined) {
      return this.overrideTypes.get(override)!;
    }
    return this.paletteTypes[colorIndex(name, this.paletteTypes.length)];
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
