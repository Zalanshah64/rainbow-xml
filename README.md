# Rainbow XML

A VS Code extension that gives every XML tag name its own color, the way Rainbow CSV gives every column its own color. All `<order>` tags match each other, opening and closing tags share a color, and the colors stay the same across every file and session. No setup needed.

## How it works

1. **Find tags.** A regular expression scans the visible lines (plus a 100-line buffer) for opening, closing, and self-closing tags. Comments, CDATA, and `<?...?>` / `<!...>` declarations are skipped.
2. **Pick a color.** Each tag name, including any namespace prefix (`soap:Body`), is hashed to pick one of 10 palette colors. The same name always gets the same color.
3. **Group ranges.** One decoration type per palette color, created once and reused.
4. **Apply decorations.** `setDecorations` paints tag names over the normal syntax colors.

Rescans are debounced by 100 ms, and lines over 20,000 characters are skipped.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `rainbowXml.enabled` | `true` | Turns coloring on or off |
| `rainbowXml.palette` | `[]` (built-in 10 colors) | A custom list of hex colors to use instead |
| `rainbowXml.colorBrackets` | `false` | Also colors the `<`, `>`, and `/` around each tag |
| `rainbowXml.overrides` | `{}` | Pins specific tag names to specific colors, e.g. `{ "order": "#ff0000" }` |
| `rainbowXml.languages` | `["xml"]` | Language modes to color (e.g. `xaml`, `svg`, `xsl`) |

Command: **Rainbow XML: Toggle** turns coloring on or off for the current file.

## Development

```sh
npm install
npm test               # compile + unit tests
npm run sample:large   # generates a 64,000-line test file in samples/
```

Press **F5** in VS Code to launch an Extension Development Host with the `samples/` folder open.

Project layout:

- `src/scanner.ts` finds tags in a block of lines (pure, unit tested)
- `src/palette.ts` hashing, built-in palette, settings validation (pure, unit tested)
- `src/decorations.ts` decoration types and painting the visible range
- `src/controller.ts` editor events, debounce, per-file toggle
- `src/config.ts` reads `rainbowXml.*` settings
- `src/extension.ts` entry point
