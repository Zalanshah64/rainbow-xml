// Pure color logic: no VS Code imports, so it can be unit tested with plain Node.

export interface ThemedColor {
  light: string;
  dark: string;
}

// Ten hues in rainbow order: the root element gets the first, its children the
// second, and so on, wrapping back to red after pink. Dark variants are bright enough for
// dark backgrounds; light variants are deeper so they stay readable on white.
export const DEFAULT_PALETTE: readonly ThemedColor[] = [
  { dark: '#ff6b6b', light: '#c92a2a' }, // red
  { dark: '#ffa94d', light: '#d9480f' }, // orange
  { dark: '#ffd43b', light: '#a86400' }, // yellow
  { dark: '#a9e34b', light: '#4f7f0a' }, // lime
  { dark: '#51cf66', light: '#2b8a3e' }, // green
  { dark: '#38d9a9', light: '#087f5b' }, // teal
  { dark: '#4dabf7', light: '#1971c2' }, // sky
  { dark: '#748ffc', light: '#3b5bdb' }, // indigo
  { dark: '#b197fc', light: '#7048e8' }, // violet
  { dark: '#f783ac', light: '#c2255c' }, // pink
];

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

/**
 * Turns the user's `rainbowXml.palette` setting into a palette. Invalid entries
 * are dropped; if nothing valid is left, the built-in palette is used.
 */
export function resolvePalette(custom: unknown): readonly ThemedColor[] {
  if (!Array.isArray(custom)) {
    return DEFAULT_PALETTE;
  }
  const colors = custom.filter(isHexColor);
  if (colors.length === 0) {
    return DEFAULT_PALETTE;
  }
  return colors.map((c) => ({ light: c, dark: c }));
}

/** Keeps only overrides whose value is a valid hex color. */
export function resolveOverrides(raw: unknown): Map<string, string> {
  const result = new Map<string, string>();
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [name, color] of Object.entries(raw)) {
      if (isHexColor(color)) {
        result.set(name, color.toLowerCase());
      }
    }
  }
  return result;
}
