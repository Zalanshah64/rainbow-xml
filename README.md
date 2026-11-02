# Rainbow XML

A VS Code extension that colors XML tags by how deeply they are nested, the way rainbow brackets color nested parentheses. The root element is red, its children are orange, their children yellow, and so on through the rainbow, wrapping back to red after pink. Opening and closing tags share a color, and attribute names match their tag. No setup needed.

## How it works

1. **Find tags.** A regular expression scans the visible lines (plus a 100-line buffer) for opening, closing, and self-closing tags. Comments, CDATA, and `<?...?>` / `<!...>` declarations are skipped.
2. **Track nesting.** A tag's depth is the number of elements open around it, and it picks the palette color at that position. A closing tag closes back to the nearest open element with the same name, so one unclosed tag doesn't shift every color after it.
3. **Save checkpoints.** Depth depends on everything above the visible lines, so the whole file is scanned once and the open elements are saved every 256 lines. After an edit, only the lines from the edit down are scanned again, and painting starts from the nearest checkpoint.
4. **Group ranges.** One decoration type per palette color, created once and reused.
5. **Apply decorations.** `setDecorations` paints tag names over the normal syntax colors.

Rescans are debounced by 100 ms, and lines over 20,000 characters are skipped.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `rainbowXml.enabled` | `true` | Turns coloring on or off |
| `rainbowXml.palette` | `[]` (built-in 10 colors) | A custom list of hex colors to use instead, in nesting order |
| `rainbowXml.colorAttributes` | `true` | Also colors attribute names to match their tag (values keep their normal color) |
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
- `src/nesting.ts` tag depths and resume checkpoints (pure, unit tested)
- `src/palette.ts` built-in palette, settings validation (pure, unit tested)
- `src/decorations.ts` decoration types and painting the visible range
- `src/controller.ts` editor events, debounce, per-file toggle
- `src/config.ts` reads `rainbowXml.*` settings
- `src/extension.ts` entry point
