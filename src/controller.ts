import * as vscode from "vscode";
import { RainbowConfig, readConfig, SECTION } from "./config";
import { TagDecorator } from "./decorations";

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
    /** False when the pending repaint only needs to move the matching-tag highlight. */
    private fullRepaintPending = false;

    /** Per-file on/off set by the Toggle command, keyed by document URI. Wins over settings. */
    private readonly fileToggles = new Map<string, boolean>();

    constructor() {
        this.config = readConfig();
        this.decorator = new TagDecorator(this.config);

        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(() => this.updateToggleContext()),
            vscode.window.onDidChangeVisibleTextEditors(() => this.refreshNow()),
            vscode.window.onDidChangeTextEditorVisibleRanges(() => this.schedule()),
            vscode.window.onDidChangeTextEditorSelection(() => this.schedule(false)),
            vscode.workspace.onDidChangeTextDocument((e) => {
                this.decorator.documentChanged(e);
                if (vscode.window.visibleTextEditors.some((ed) => ed.document === e.document)) {
                    this.schedule();
                }
            }),
            vscode.workspace.onDidOpenTextDocument(() => this.schedule()), // language mode changes reopen the document
            vscode.workspace.onDidCloseTextDocument((doc) => {
                this.fileToggles.delete(doc.uri.toString());
                this.decorator.documentClosed(doc);
            }),
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration(SECTION)) {
                    this.config = readConfig();
                    this.decorator.setConfig(this.config);
                    this.updateLanguagesContext();
                    this.refreshNow();
                }
            }),
        );

        this.updateLanguagesContext();
        this.updateToggleContext();
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
        this.updateToggleContext();
        this.refreshNow();
        vscode.window.setStatusBarMessage(`Rainbow XML: ${on ? "on" : "off"} for this file`, 2000);
    }

    dispose(): void {
        clearTimeout(this.timer);
        this.disposables.forEach((d) => d.dispose());
        this.decorator.dispose();
    }

    // Context keys for the right-click menu, which shows in the configured
    // languages and in any file the Toggle command has been used on.
    private updateLanguagesContext(): void {
        void vscode.commands.executeCommand("setContext", "rainbowXml.languages", [
            ...this.config.languages,
        ]);
    }

    private updateToggleContext(): void {
        const doc = vscode.window.activeTextEditor?.document;
        void vscode.commands.executeCommand(
            "setContext",
            "rainbowXml.fileToggled",
            doc !== undefined && this.fileToggles.has(doc.uri.toString()),
        );
    }

    private isEnabledFor(doc: vscode.TextDocument): boolean {
        return (
            this.fileToggles.get(doc.uri.toString()) ??
            (this.config.enabled && this.config.languages.has(doc.languageId))
        );
    }

    /** Repaints after a pause. `full` false means only the matching-tag highlight needs updating. */
    private schedule(full = true): void {
        this.fullRepaintPending ||= full;
        clearTimeout(this.timer);
        this.timer = setTimeout(
            () => (this.fullRepaintPending ? this.refreshNow() : this.refreshMatches()),
            DEBOUNCE_MS,
        );
    }

    private refreshNow(): void {
        clearTimeout(this.timer);
        this.timer = undefined;
        this.fullRepaintPending = false;
        for (const editor of vscode.window.visibleTextEditors) {
            if (this.isEnabledFor(editor.document)) {
                this.decorator.paint(editor);
            } else {
                this.decorator.clear(editor);
            }
        }
    }

    private refreshMatches(): void {
        this.timer = undefined;
        const editor = vscode.window.activeTextEditor;
        if (editor && this.isEnabledFor(editor.document)) {
            this.decorator.paintMatch(editor);
        }
    }
}
