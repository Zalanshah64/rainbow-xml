// Pure color logic: no VS Code imports, so it can be unit tested with plain Node.

export interface ThemedColor {
    light: string;
    dark: string;
}

// Ten hues in rainbow order: the root element gets the first, its children the
// second, and so on, wrapping back to red after pink. Dark variants are bright enough for
// dark backgrounds; light variants are deeper so they stay readable on white.
// These are the defaults for the theme colors in package.json (a test keeps them in sync).
export const DEFAULT_PALETTE: readonly ThemedColor[] = [
    { dark: "#ff6b6b", light: "#c92a2a" }, // red
    { dark: "#ffa94d", light: "#d9480f" }, // orange
    { dark: "#ffd43b", light: "#a86400" }, // yellow
    { dark: "#a9e34b", light: "#4f7f0a" }, // lime
    { dark: "#51cf66", light: "#2b8a3e" }, // green
    { dark: "#38d9a9", light: "#087f5b" }, // teal
    { dark: "#4dabf7", light: "#1971c2" }, // sky
    { dark: "#748ffc", light: "#3b5bdb" }, // indigo
    { dark: "#b197fc", light: "#7048e8" }, // violet
    { dark: "#f783ac", light: "#c2255c" }, // pink
];

/** Theme color IDs for the palette: `rainbowXml.color1` through `rainbowXml.color10`. */
export const THEME_COLOR_IDS: readonly string[] = DEFAULT_PALETTE.map(
    (_, i) => `rainbowXml.color${i + 1}`,
);

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function isHexColor(value: unknown): value is string {
    return typeof value === "string" && HEX_COLOR.test(value);
}

/**
 * Reads the user's `rainbowXml.palette` setting. Invalid entries are dropped.
 * Returns undefined when nothing valid is left, meaning: use the theme colors.
 */
export function resolvePalette(custom: unknown): string[] | undefined {
    const colors = Array.isArray(custom) ? custom.filter(isHexColor) : [];
    return colors.length > 0 ? colors : undefined;
}

/** Keeps only overrides whose value is a valid hex color. */
export function resolveOverrides(raw: unknown): Map<string, string> {
    const result = new Map<string, string>();
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        for (const [name, color] of Object.entries(raw)) {
            if (isHexColor(color)) {
                result.set(name, color.toLowerCase());
            }
        }
    }
    return result;
}

/**
 * Stable 32-bit hash of a tag name (FNV-1a plus a final mix step so that
 * similar names like `item1` and `item2` spread across the palette).
 * Same input always gives the same output, across files and sessions.
 */
export function hashName(name: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < name.length; i++) {
        h ^= name.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
}

/** Palette position for a tag name when coloring by name. */
export function colorIndex(name: string, paletteSize: number): number {
    return hashName(name) % paletteSize;
}
