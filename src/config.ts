import * as vscode from "vscode";
import { resolveOverrides, resolvePalette, THEME_COLOR_IDS } from "./palette";

export const SECTION = "rainbowXml";

export type ColorBy = "depth" | "name";

export interface RainbowConfig {
    enabled: boolean;
    colorBy: ColorBy;
    /** Hex colors from the `palette` setting, or the `rainbowXml.colorN` theme colors. */
    palette: readonly (string | vscode.ThemeColor)[];
    colorBrackets: boolean;
    colorAttributes: boolean;
    highlightMatchingTag: boolean;
    markUnmatchedTags: boolean;
    overrides: Map<string, string>;
    languages: ReadonlySet<string>;
}

export function readConfig(): RainbowConfig {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    const languages = cfg.get<unknown>("languages");
    return {
        enabled: cfg.get<boolean>("enabled", true),
        colorBy: cfg.get<string>("colorBy") === "name" ? "name" : "depth",
        palette:
            resolvePalette(cfg.get<unknown>("palette")) ??
            THEME_COLOR_IDS.map((id) => new vscode.ThemeColor(id)),
        colorBrackets: cfg.get<boolean>("colorBrackets", false),
        colorAttributes: cfg.get<boolean>("colorAttributes", true),
        highlightMatchingTag: cfg.get<boolean>("highlightMatchingTag", true),
        markUnmatchedTags: cfg.get<boolean>("markUnmatchedTags", true),
        overrides: resolveOverrides(cfg.get<unknown>("overrides")),
        languages: new Set(
            Array.isArray(languages)
                ? languages.filter((l): l is string => typeof l === "string")
                : ["xml"],
        ),
    };
}
