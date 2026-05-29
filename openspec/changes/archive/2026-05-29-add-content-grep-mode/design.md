## Context

`/microscope` currently has a working Pi-native picker for project files, multi-select insertion, and git-changed files. The current implementation uses one shared candidate shape (`FileCandidate`), a `PickerMode` union with `project-files` and `git-changed`, `FffFinderService.search()` for fuzzy file lookup, `GitChangedService.search()` for changed-file lookup, `previewFile()` for bounded file previews, and `insertPathReferences()` for prompt-editor mutation.

The source design frames pi-microscope as a context palette, not just a file picker. Content grep is the next mode in that direction: users should be able to search by remembered code text, see matching snippets, preview the matching file near the hit, and insert `@relative/path` references without changing the existing project/git flows.

## Goals / Non-Goals

**Goals:**

- Add `content-grep` as a third picker mode.
- Search file contents with `@ff-labs/fff-node` grep support.
- Display each grep hit as `relative/path:line` plus a matching line snippet.
- Preview grep hits around the matched line while preserving existing top-of-file previews for project/git results.
- Keep multi-select behavior across all modes, and dedupe inserted `@relative/path` references when multiple grep hits map to the same file.
- Preserve current project-file and git-changed behavior.
- Cover the behavior with unit tests and run the existing Bun/type/lint/format checks.

**Non-Goals:**

- Prompt-aware ranking.
- Token budgeting or token-cost estimates.
- Saved presets or recent context sets.
- Regex/fuzzy grep mode UI. This change should use plain smart-case grep first.
- New insertion formats beyond `@relative/path`.

## Decisions

### 1. Model grep as a first-class picker mode

Add `"content-grep"` to `PickerMode`, `PICKER_MODE_LABELS`, config validation, default key hints, and mode-switching tests. Keep project files as the default initial mode.

Rationale: the picker already routes behavior by mode. Adding a mode preserves the current architecture and avoids a separate command.

Alternative considered: create `/microscope-grep`. Rejected because it splits the context assembly workflow and duplicates picker behavior.

### 2. Extend the existing finder boundary for grep

Extend `FinderService` and `NativeFinder` with a grep method, implemented by the same `FffFinderService` instance used for file search. Map `GrepMatch` values into `FileCandidate` values with grep metadata:

- `relativePath`
- `fileName`
- `gitStatus`
- `size`
- `lineNumber`
- `lineSnippet`
- optional `matchRanges` / column metadata if useful for later highlighting

Use `finder.grep(query, { mode: "plain", smartCase: true, pageSize })` for this change. Empty or whitespace-only grep queries should return an empty/help result instead of scanning every file.

Rationale: grep belongs beside file search because both use the same native `FileFinder` lifecycle and scan state. Reusing `FffFinderService` keeps cleanup on `session_shutdown` unchanged.

Alternative considered: separate `ContentGrepService`. Rejected for now because it would own the same native finder lifecycle and increase dependency wiring without adding isolation.

### 3. Enable content-capable finder initialization

Current finder creation passes `disableContentIndexing: true`. For content grep, omit that flag or set it to `false` so grep can use `fff-node`'s content-aware path where available. Keep the existing scan timeout behavior: if scan wait times out, search may still return current/partial index results.

Rationale: grep is the point of this change, and the dependency already exposes content search support.

Trade-off: enabling content indexing may increase initial scan work and memory. Mitigation is bounded grep page size and future config only if dogfooding shows need.

### 4. Use row identity separately from inserted reference identity

Grep mode can return multiple rows for the same `relativePath`. The picker should track selected rows by a stable row key, not only by `relativePath`. For project/git candidates, the row key can remain the path. For grep candidates, derive a key from path + line + column/offset + result index.

Prompt insertion should dedupe by normalized `relativePath` after confirmation.

Rationale: users can see and select individual grep hits while the prompt receives each file reference only once.

Alternative considered: keep selection keyed by `relativePath`. Rejected because multiple rows for one file would all appear selected together and duplicate-path validation would block legitimate grep results.

### 5. Make preview line-aware, not grep-specific

Extend `PreviewResult` with an optional `startLine` (default `1`) and make `previewFile()` center the returned window around `candidate.lineNumber` when present. `MultiSelectPickerComponent.renderPreview()` should use `startLine + index` for displayed line numbers.

Rationale: line-aware preview is useful for grep now and future location-aware file references later, while existing callers keep the same behavior when no line is present.

Alternative considered: put numbered lines directly into `PreviewResult.lines`. Rejected because preview rendering should keep one responsibility for display formatting and width truncation.

### 6. Keep mode switching backward-compatible

Existing direct project/git mode keys should keep working. Add content grep to the mode cycle/toggle behavior and footer labels. If the current implementation has only direct mode keys, add a content-grep key and a small helper that defines the canonical mode order: `project-files -> git-changed -> content-grep -> project-files`.

Rationale: the user requested a mode toggle across all three modes while also requiring project/git modes to remain unchanged.

## Risks / Trade-offs

- Duplicate grep paths can break current selection validation → introduce row keys and dedupe only at insertion.
- Empty grep query can cause broad/expensive scans → return a help/empty result until query is non-empty.
- Content indexing can increase startup cost → keep page size bounded and do not add extra ranking or pagination UI in this change.
- Line-centered preview can accidentally regress normal previews → default `startLine` to `1` and keep project/git candidates without `lineNumber`.
- `fff-node` grep errors or regex fallback fields can leak confusing messages → use plain mode and surface `Result.error` through existing picker error paths.

## Migration Plan

1. Extend types and config for `content-grep`.
2. Add grep mapping to `FffFinderService` and native adapter types.
3. Route `content-grep` in `createMicroscopeHandler()`.
4. Update picker rendering, row selection keys, mode controls, and footer labels.
5. Update preview to support matched-line windows.
6. Add/adjust tests, then run `bun test`, `bun run check-types`, `bun run lint`, and `bun run format:check`.

Rollback is a normal code revert. No persistent data migration is required.

## Open Questions

- Exact default key for content grep mode should follow current picker ergonomics during implementation. Prefer a non-conflicting key and document it in the footer/tests.
- Match highlighting is intentionally deferred; this change only needs snippets and line-centered preview.
