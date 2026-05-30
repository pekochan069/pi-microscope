## 1. Saved Set Storage

- [x] 1.1 Add `src/context-sets.ts` with versioned saved-set types, project-local path resolution, read/write helpers, and missing-store-as-empty behavior.
- [x] 1.2 Implement saved-set name validation, replacement by normalized name, and pretty JSON writes that create `.pi/microscope/` when needed.
- [x] 1.3 Add path normalization and first-occurrence dedupe for persisted saved-set paths using existing reference normalization semantics.
- [x] 1.4 Add saved-path estimate helpers that stat readable project files, count unreadable/deleted files as unknown, and use existing byte-to-token semantics.
- [x] 1.5 Add storage tests for missing store, project-local isolation, duplicate paths, existing-name replacement, corrupt/invalid JSON handling, and estimate calculation.

## 2. Picker Selection Model

- [x] 2.1 Refactor `PickerState` so visible row selection and insertable normalized reference paths are tracked separately.
- [x] 2.2 Update manual toggle behavior to preserve grep row-key selection while keeping deduped file-path selection for counts, budget, and insertion.
- [x] 2.3 Update confirmation helpers so picker confirmation can return loaded saved-set paths even when those paths are not visible in current candidates.
- [x] 2.4 Preserve existing mode/query reload selection-clearing behavior except when a saved set has just been loaded into current selection.
- [x] 2.5 Update picker state tests for project candidates, git candidates, duplicate grep rows, loaded off-screen paths, and first-occurrence ordering.

## 3. Saved Set Picker Actions

- [x] 3.1 Add configurable saved-set keybindings to config types/defaults/parsing for save, load, and delete actions.
- [x] 3.2 Add picker action mode for saving selected paths under a typed non-empty name, with Esc cancellation and no editor mutation.
- [x] 3.3 Add picker action mode for listing saved sets with name, file count, bytes, approximate tokens, and unknown-size count.
- [x] 3.4 Add load behavior that replaces current selection with the selected saved set and marks visible matching rows where possible.
- [x] 3.5 Add delete behavior that removes the selected saved set, updates saved-set count, and leaves prompt editor/selection behavior predictable.
- [x] 3.6 Update picker render/footer/header text to show saved set count, selected file count, and saved-set action hints.

## 4. Command Integration

- [x] 4.1 Wire saved-set storage into `createMicroscopeHandler()` using `deps.basePath ?? ctx.cwd` as the project root.
- [x] 4.2 Adapt `pickFiles`/command result types so command insertion receives normalized relative paths while preserving existing `insertReferencesIntoEditor()` behavior.
- [x] 4.3 Update inserted notification text to use deduped loaded paths and retain existing single-file/multi-file message semantics.
- [x] 4.4 Ensure save, load, and delete failures notify the user and leave the prompt editor unchanged.

## 5. Cross-Mode Behavior and Tests

- [x] 5.1 Add tests for saving selections in project-file mode, git-changed mode, and content grep mode.
- [x] 5.2 Add tests for loading saved sets from project-file, git-changed, and content grep modes when saved paths are not visible.
- [x] 5.3 Add tests for deleting saved sets, no-saved-set load/delete states, and saved-set count updates.
- [x] 5.4 Add command/editor tests proving loaded saved sets insert with existing append-only spacing and dedupe behavior.
- [x] 5.5 Add config tests for saved-set key defaults, project overrides, and invalid key warnings.

## 6. Validation

- [x] 6.1 Run `bun test`.
- [x] 6.2 Run `bun run check-types`.
- [x] 6.3 Run `bun run lint`.
- [x] 6.4 Run `bun run format:check`.
- [x] 6.5 Record files changed, saved-set behavior added, checks run, and known follow-ups in the implementation summary.
