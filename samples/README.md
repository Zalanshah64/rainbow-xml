# Rainbow XML samples

Press **F5** in the main project to open these files in an Extension Development Host. Each file starts with a comment that says which settings to use and what to check. To change settings, uncomment lines in [.vscode/settings.json](.vscode/settings.json). Changes apply right away.

Files 03, 05, 06, 08, and 12 contain deliberate mistakes, so an XML validator (such as the Red Hat XML extension) will flag errors in them.

| File | Feature | Settings to try |
| --- | --- | --- |
| [01-depth-colors.xml](01-depth-colors.xml) | Colors by nesting level, wrapping after 10 levels; siblings, self-closing and split tags | defaults |
| [02-color-by-name.xml](02-color-by-name.xml) | The same name is the same color at any depth and in any file; prefixes and case count | `colorBy: "name"` |
| [03-attributes-and-brackets.xml](03-attributes-and-brackets.xml) | Attribute names match their tag; values, and `>` or `/` inside values, are left alone | `colorAttributes: false`, `colorBrackets: true` |
| [04-skipped-content.xml](04-skipped-content.xml) | Comments, CDATA, DOCTYPE, and processing instructions are skipped without shifting colors | defaults |
| [05-matching-tags.xml](05-matching-tags.xml) | Matching-tag highlight: nested same names, multi-line tags, multiple cursors, unmatched tags | `highlightMatchingTag: false` |
| [06-unmatched-tags.xml](06-unmatched-tags.xml) | Wavy underlines, hover messages, scrollbar marks; colors recover after mistakes | `markUnmatchedTags: false` |
| [07-overrides.xml](07-overrides.xml) | Pinned colors for specific names, with prefix and case rules | `overrides` |
| [08-html.html](08-html.html) | Void elements, case-insensitive names, `<script>`/`<style>` skipped, a known limitation | `languages: ["xml", "html"]` |
| [09-languages.svg](09-languages.svg) | SVG opens in XML mode, so it's colored by default | defaults |
| [09-languages.xsl](09-languages.xsl) | XSL has its own language mode: not colored until added, or until you run **Rainbow XML: Toggle** | `languages: ["xml", "xsl"]` |
| [10-checkpoints.xml](10-checkpoints.xml) | 1,000 lines: comments, tags, and CDATA crossing the saved-state boundaries; edits near the top; matching across the file; folding | defaults |
| [11-long-line.xml](11-long-line.xml) | A line over 20,000 characters is skipped without breaking the nesting | defaults |
| [12-edge-cases.xml](12-edge-cases.xml) | Unicode and punctuation in names, things that look like tags, a tag unfinished at the end of the file | defaults |
| `large.xml` | Speed: 64,000 lines. Run `npm run sample:large` first (it isn't committed) | defaults |

## Also try

- **Theme colors.** Uncomment the `workbench.colorCustomizations` block in the settings file, then switch themes (Ctrl+K Ctrl+T). Try a light theme, a dark theme, and a high contrast theme with the defaults too: each has its own palette variants.
- **Custom palette.** Uncomment `rainbowXml.palette`. With 7 colors, 01-depth-colors.xml wraps after level 7.
- **Toggle.** In any colored file, run **Rainbow XML: Toggle** from the Command Palette (Ctrl+Shift+P) to turn coloring off for that file only.
- **Split editors.** Open the same file side by side and scroll each half separately. Both stay colored.
- **Speed.** In `large.xml`: open it, hold Page Down, jump to the end with Ctrl+End, and type near the top. Typing should stay smooth and colors should catch up within a moment. Put the cursor on `<catalog>` at the top and press Ctrl+End: `</catalog>` is highlighted.
