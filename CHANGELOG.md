# Changelog

## 1.0.0

First release.

- Colors XML tags by nesting depth, with opening and closing tags sharing a color.
- Colors attribute names to match their tag.
- Optional coloring by tag name instead of depth (`rainbowXml.colorBy`).
- Highlights the matching opening or closing tag under the cursor.
- Marks unmatched tags with a wavy underline, hover message, and scrollbar mark.
- HTML support: void elements, case-insensitive names, and skipped `<script>`/`<style>` contents.
- Theme colors with light, dark, and high contrast variants, plus a custom palette and per-tag overrides.
- **Rainbow XML: Toggle** command to turn coloring on or off for one file.
