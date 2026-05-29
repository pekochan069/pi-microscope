## Context

`pi-microscope` currently ships a minimal `/microscope [query]` flow: `FffFinderService.search()` returns file candidates, `pickFile()` maps candidates to exact `relativePath` strings through `ctx.ui.select()`, and `insertReferenceIntoEditor()` appends one `@relative/path` reference with safe spacing.

The approved product design names multi-select context packs as the first power-user direction after the focused file picker MVP. This change should keep existing finder/editor boundaries, but replace the single-result picker contract with a multi-result contract so one picker session can assemble several file references.

## Goals / Non-Goals

**Goals:**

- Let users toggle file candidates selected/unselected inside the picker.
- Show selected count while the picker is open.
- Make Enter insert every selected candidate as `@relative/path` references in one editor update.
- Preserve current single-file Enter behavior when no candidates are selected.
- Keep editor insertion rules deterministic and covered by pure tests.

**Non-Goals:**

- Git-changed mode, content/grep mode, prompt-aware ranking, token estimates, saved context packs, or configurable insertion formats.
- Changing finder ranking/search semantics.
- Cursor-position insertion; this remains append-only through `getEditorText()` / `setEditorText()`.
- Full preview panel or broader Telescope-style UI work unless needed by the selected-count UI.

## Decisions

### 1. Promote picker result from one candidate to many candidates

Change picker boundary from `pickFile(...): Promise<FileCandidate | undefined>` to a multi-select-friendly API such as `pickFiles(...): Promise<FileCandidate[] | undefined>`.

- `undefined` means cancel/no editor mutation.
- `[]` should not be returned by normal picker completion; Enter with no selected files returns the highlighted candidate as a one-item array.
- Non-empty arrays preserve picker/result order for insertion.

Alternative considered: keep `pickFile()` and loop command-level prompts. Rejected because selected count and Enter-to-insert-all are picker-level behavior, not command orchestration behavior.

### 2. Add a small picker state reducer before wiring custom UI details

Implement pure state helpers for selected path set, highlighted index, toggle action, confirm action, and rendered labels. Tests should cover these helpers without driving a terminal.

Recommended state shape:

```ts
interface PickerState {
  highlightedIndex: number;
  selectedPaths: Set<string>;
}
```

Rules:

- Toggle current highlighted path on Space.
- Up/down keep highlighted index in bounds.
- Confirm returns selected candidates when `selectedPaths.size > 0`.
- Confirm returns current highlighted candidate when `selectedPaths.size === 0`.
- Render each row with `[x]` or `[ ]` marker and footer/title count like `Selected: 2`.

Alternative considered: infer selected files from display labels. Rejected because exact candidate identity should remain path-based and testable.

### 3. Use custom picker UI if built-in `ctx.ui.select()` cannot expose toggle keys

`ctx.ui.select()` is enough for the MVP because it returns one string, but multi-select requires Space toggles, visible count updates, and Enter confirmation independent of row selection. Implement a focused `ctx.ui.custom()` overlay/component when necessary, using `matchesKey()` for `space`, `enter`, `escape`, `up`, and `down`.

Keep the UI intentionally small:

- No live search beyond the existing `/microscope [query]` candidate list.
- No preview panel in this change.
- Width-safe rows with exact `relativePath` visible.
- Footer: `↑↓ move • Space select/unselect • Enter insert selected/current • Esc cancel`.

Alternative considered: fake multi-select with repeated `ctx.ui.select()` dialogs and an `Insert selected` sentinel option. Rejected because it breaks current Enter behavior and creates ambiguous selection/toggle semantics.

### 4. Add batch editor insertion helper

Add `insertPathReferences(currentText, relativePaths)` in `src/editor.ts` and keep `insertPathReference()` as a one-path wrapper.

Rules:

- Normalize every relative path through existing `normalizePathReference()`.
- Join references with single spaces: `@a.ts @b.ts`.
- If current editor text is empty or ends with whitespace, append the joined references directly.
- Otherwise insert one separating space before the joined references.
- Keep order from picker confirmation; do not introduce sorting or duplicate insertion from the editor helper.

Alternative considered: call `insertPathReference()` repeatedly. Rejected because it still works but causes more side-effect temptation at command level; one pure batch transform plus one `setEditorText()` call is easier to test.

### 5. Keep command side effects single-shot

Command flow remains:

```text
/microscope args
  -> validate ctx.hasUI
  -> finder.search(query)
  -> pickFiles(ctx.ui, candidates, query)
  -> if cancel return
  -> setEditorText(insertPathReferences(currentText, selected relativePaths))
  -> notify inserted count/path summary
```

The command MUST call `setEditorText()` at most once per successful invocation and never on cancel, no-results, finder-error, or non-UI paths.

## Risks / Trade-offs

- Custom overlay API is more code than `ctx.ui.select()` → Mitigation: keep state reducer pure and UI wrapper thin; no preview/live-search in this change.
- Space key may not be obvious → Mitigation: show footer instructions and selected count on every render.
- Large candidate list rendering could be noisy → Mitigation: reuse current finder page size and render only visible slice if the TUI component needs scroll bounds.
- Duplicate candidate paths could corrupt selected set → Mitigation: keep existing duplicate path guard before opening picker.
- Batch insertion with path normalization can throw after selection → Mitigation: normalize candidates before insertion in pure helper tests; command should surface an error notification and avoid partial editor updates if normalization fails.

## Migration Plan

1. Add pure batch insertion helper and tests while keeping single insertion behavior unchanged.
2. Add picker state helpers and tests for toggle/count/confirm behavior.
3. Replace `pickFile` command wiring with `pickFiles` and update command tests.
4. Wire custom picker UI or selected-count-capable wrapper behind the same picker boundary.
5. Run `bun test`, `bun run check-types`, `bun run lint`, and `bun run format:check`.

Rollback is straightforward: keep `insertPathReference()` compatibility and revert command wiring to one selected candidate if custom picker behavior fails dogfood.

## Open Questions

- Exact row viewport behavior can be chosen during implementation after seeing available `pi-tui` helpers; requirement is visible selected count, not a specific layout.
- Notification copy can be concise: one path for single insertion, `Inserted N file references` for multi-insertion.
