## 1. Mode and Configuration

- [x] 1.1 Add `content-grep` to `PickerMode`, `PICKER_MODE_LABELS`, config mode validation, and default options without changing the default `project-files` initial mode.
- [x] 1.2 Add mode-order helpers so the picker can cycle `project-files -> git-changed -> content-grep -> project-files` while preserving existing direct project/git mode controls.
- [x] 1.3 Update config tests for valid `content-grep` initial mode, invalid-mode warnings, and any new content-grep key defaults.

## 2. Finder Content Grep

- [x] 2.1 Extend `NativeFinder` and `FinderService` with a content grep method backed by `FileFinder.grep()`.
- [x] 2.2 Enable content-capable finder initialization by removing or disabling `disableContentIndexing: true` in `FffFinderService`.
- [x] 2.3 Map `GrepMatch` results into `FileCandidate` values with relative path, file name, git status, size, 1-based line number, line snippet, and stable grep row metadata.
- [x] 2.4 Return a clear empty/help result for empty grep queries and a clear no-match result for non-empty queries with no matches.
- [x] 2.5 Add finder tests for grep success, empty query, no matches, native grep errors, and grep result mapping.

## 3. Picker Rendering and Selection

- [x] 3.1 Render content grep rows as path plus matching line number and snippet while keeping project/git row rendering unchanged.
- [x] 3.2 Track picker selection by stable row key instead of only `relativePath` so multiple grep hits from one file can appear as separate rows.
- [x] 3.3 Keep prompt insertion deduped by normalized `relativePath` after confirmation.
- [x] 3.4 Update mode switching, footer hints, loading messages, and no-result messages for content grep mode.
- [x] 3.5 Add picker tests for three-mode cycling, grep row rendering, duplicate-path grep selections, and unchanged project/git behavior.

## 4. Line-Aware Preview

- [x] 4.1 Extend `FileCandidate` and `PreviewResult` to carry optional match-line/start-line metadata.
- [x] 4.2 Update `previewFile()` to center bounded previews around `candidate.lineNumber` when present and to keep top-of-file previews when absent.
- [x] 4.3 Update preview rendering to display real file line numbers for line-centered previews.
- [x] 4.4 Add preview tests for matched-line windows, start-line numbering, workspace/binary/unreadable guards, and unchanged normal previews.

## 5. Command Wiring and Editor Insertion

- [x] 5.1 Route `content-grep` mode in `createMicroscopeHandler()` to the finder grep method.
- [x] 5.2 Dedupe inserted references for selected grep rows and update insertion notification text if multiple selected rows collapse to fewer file references.
- [x] 5.3 Add command tests for content-grep routing, highlighted grep insertion, selected grep insertion, duplicate-path dedupe, cancel behavior, and preserved project/git routing.

## 6. Verification

- [x] 6.1 Run `bun test`.
- [x] 6.2 Run `bun run check-types`.
- [x] 6.3 Run `bun run lint`.
- [x] 6.4 Run `bun run format:check`.
