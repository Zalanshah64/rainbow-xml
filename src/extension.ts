import * as vscode from "vscode";
import { RainbowController } from "./controller";

export function activate(context: vscode.ExtensionContext): void {
    const controller = new RainbowController();
    context.subscriptions.push(
        controller,
        vscode.commands.registerCommand("rainbowXml.toggle", () => controller.toggleActive()),
    );
}

export function deactivate(): void {
    // Everything is cleaned up through context.subscriptions.
}
