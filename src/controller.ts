import * as vscode from 'vscode';
import { RainbowConfig, readConfig, SECTION } from './config';
import { TagDecorator } from './decorations';

/** Wait this long after scrolling or typing stops before rescanning. */
const DEBOUNCE_MS = 100;

/**
 * Listens to editor events and decides when and where to repaint.
 * All repaints go through a single debounce timer.
 */
export class RainbowController implements vscode.Disposable {
  private config: RainbowConfig;
  private readonly decorator: TagDecorator;
  private readonly disposables: vscode.Disposable[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** Per-file on/off set by the Toggle command, keyed by document URI. Wins over settings. */
  private readonly fileToggles = new Map<string, boolean>();

  constructor() {
    this.config = readConfig();
    this.decorator = new TagDecorator(this.config);

    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors(() => this.refreshNow()),
      vscode.window.onDidChangeTextEditorVisibleRanges(() => this.schedule()),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (vscode.window.visibleTextEditors.some((ed) => ed.document === e.document)) {
          this.schedule();
        }
      }),
      vscode.workspace.onDidOpenTextDocument(() => this.schedule()), // language mode changes reopen the document
      vscode.workspace.onDidCloseTextDocument((doc) => this.fileToggles.delete(doc.uri.toString())),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(SECTION)) {
          this.config = readConfig();
          this.decorator.setConfig(this.config);
          this.refreshNow();
        }
      }),
    );

    this.refreshNow();
  }

  /** Flips coloring for the active editor's file. */
  toggleActive(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const on = !this.isEnabledFor(editor.document);
    this.fileToggles.set(editor.document.uri.toString(), on);
    this.refreshNow();
    vscode.window.setStatusBarMessage(`Rainbow XML: ${on ? 'on' : 'off'} for this file`, 2000);
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.disposables.forEach((d) => d.dispose());
    this.decorator.dispose();
  }

  private isEnabledFor(doc: vscode.TextDocument): boolean {
    return (
      this.fileToggles.get(doc.uri.toString()) ??
      (this.config.enabled && this.config.languages.has(doc.languageId))
    );
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refreshNow(), DEBOUNCE_MS);
  }

  private refreshNow(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    for (const editor of vscode.window.visibleTextEditors) {
      if (this.isEnabledFor(editor.document)) {
        this.decorator.paint(editor);
      } else {
        this.decorator.clear(editor);
      }
    }
  }
}
