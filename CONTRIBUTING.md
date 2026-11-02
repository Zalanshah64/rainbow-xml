# Contributing to Rainbow XML

## Building and testing

```sh
npm install
npm test               # compile + unit tests
npm run sample:large   # generates a 64,000-line test file in samples/
```

Press **F5** in VS Code to launch an Extension Development Host with the `samples/` folder open. [samples/README.md](samples/README.md) says what to check in each sample file.

The browser version (vscode.dev) is a separate bundle built with esbuild into `dist/web/`. To try it, run `npm run run-web`, which opens VS Code for the web in a browser with the `samples/` folder. The first run downloads a copy of VS Code into `.vscode-test-web/`. The extension can't use Node.js APIs (`fs`, `path`, and so on), or the browser version breaks.

Tests run on Linux, Windows, and macOS for every push and pull request.

## Project layout

- `src/scanner.ts` finds tags in a block of lines, with optional HTML rules (pure, unit tested)
- `src/nesting.ts` tag depths, checkpoints, and unmatched tags (pure, unit tested)
- `src/tagIndex.ts` whole-document index: incremental rescans after edits, matching-tag search (pure, unit tested)
- `src/palette.ts` built-in palette, name hashing, settings validation (pure, unit tested)
- `src/decorations.ts` decoration types and painting the visible range
- `src/controller.ts` editor events, debounce, per-file toggle
- `src/config.ts` reads `rainbowXml.*` settings
- `src/extension.ts` entry point

## Releasing

1. Add the new version's changes to [CHANGELOG.md](CHANGELOG.md).
2. Publish a GitHub release with a tag like `v1.2.0`. Tick **Set as a pre-release** for a Marketplace pre-release.

The [publish workflow](.github/workflows/publish.yml) takes the version from the tag, runs the tests, publishes to the VS Code Marketplace, and attaches the `.vsix` to the release. Tags must be plain `major.minor.patch` numbers; the Marketplace rejects suffixes like `-beta.1`.
