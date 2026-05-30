## Context

`/microscope` has one interactive picker that now spans project files, git-changed files, and content grep results. Selection is currently tracked by visible row key (`rowKey ?? relativePath`), while insertion and budget summaries dedupe by normalized `relativePath`. That works for visible candidates, including duplicate grep hits, but saved context sets need a path-based selection layer because a loaded set can contain files that are not visible in the current mode/query.

Saved sets must be project-local, not global settings. The storage target is `.pi/microscope/context-sets.json` under the active project/workspace. Existing editor insertion helpers should remain the only prompt mutation path.

## Goals / Non-Goals

**Goals:**

- Save explicit current picker selections as named context sets.
- Load a saved set into the picker selection from any picker mode, even when loaded paths are not visible in current results.
- Delete a saved set from project-local storage.
- Persist deduped normalized paths plus byte/token estimates for each saved set.
- Display saved set count, selected count, and saved-set estimates in the picker UI.
- Keep project-file, git-changed, and content grep selection/insertion behavior compatible.
- Preserve append-only `@relative/path` insertion semantics.

**Non-Goals:**

- Prompt-aware ranking, recommendations, auto-trimming, or auto-loading.
- Global saved context sets shared across projects.
- Exact tokenizer integration.
- New insertion formats or inline file content insertion.
- Sync/conflict handling for concurrent writes by multiple picker sessions.

## Decisions

### 1. Add a project-local saved-set storage service

Create a small storage module, likely `src/context-sets.ts`, responsible for reading/writing `.pi/microscope/context-sets.json` relative to the command base path/cwd.

Proposed persisted schema:

```ts
interface ContextSetsFile {
  version: 1;
  sets: SavedContextSet[];
}

interface SavedContextSet {
  name: string;
  paths: string[];
  bytes: number;
  approxTokens: number;
  unknownFileCount: number;
  updatedAt: string;
}
```

Storage helpers should create `.pi/microscope/` on first save, tolerate a missing file as an empty store, validate loaded JSON before use, and write pretty JSON for easy manual inspection.

Alternative considered: store in global Pi settings. Rejected because saved context is repository-specific and paths only make sense relative to one project.

### 2. Dedupe and normalize paths before persistence

Saved sets should store normalized path references using the same semantics as `normalizePathReference()` and insertion dedupe. Duplicate content-grep hits or repeated selections for one file become one persisted path, preserving first selected occurrence order.

Alternative considered: store row keys for exact grep hits. Rejected because saved sets insert file references, not location references, and grep row keys are not stable across future searches.

### 3. Reuse budget estimation semantics for saved-set metadata

Saved-set estimates should use the existing byte-to-approx-token heuristic (`ceil(bytes / 4)`) so picker budget UI and saved-set UI speak the same language. When saving from live candidates, use candidate metadata where available. When loading or refreshing stored sets, stat paths relative to the project root where possible; unreadable, deleted, or escaping paths count as unknown.

Alternative considered: store only paths and compute estimates every render. Rejected because render should stay cheap and saved-set list rows need stable summary text.

### 4. Split visible row selection from path selection

Refactor picker selection state so visible row identity and insertable path identity are separate. Suggested shape:

```ts
interface PickerState {
  mode: PickerMode;
  highlightedIndex: number;
  selectedRowKeys: Set<string>;
  selectedReferencePaths: string[];
}
```

Manual toggles update both row markers and deduped reference paths. Loading a saved set replaces `selectedReferencePaths` with the saved paths and marks any currently visible rows whose paths match. Confirmation returns normalized reference paths, not only visible candidates, so loaded off-screen/off-mode paths can still insert.

Alternative considered: keep filtering the current candidate list in `confirmPickerSelection()`. Rejected because loaded saved sets would fail whenever current mode/query does not include saved files.

### 5. Keep insertion boundary unchanged

`createMicroscopeHandler()` should continue to call `insertReferencesIntoEditor()` and `insertPathReferences()` for prompt mutation. It can adapt picker output from candidates to normalized path arrays, but final editor text generation stays unchanged.

Alternative considered: have saved-set actions write directly to the prompt. Rejected because it bypasses existing append-only spacing guarantees and complicates cancellation behavior.

### 6. Implement saved-set actions inside the existing picker component

Add configurable keybindings under `piMicroscope.keys`, with non-printing defaults such as `alt+s` (save), `alt+l` (load), and `alt+d` (delete). The picker component can use small action modes instead of nested UI primitives:

- Save mode: prompt for a set name in the picker, Enter saves selected paths, Esc cancels.
- Load mode: list saved sets with `name • N files • bytes • ~tokens`, Enter loads highlighted set, Esc cancels.
- Delete mode: list saved sets with the same summary, Enter deletes highlighted set, Esc cancels.

Alternative considered: add separate `/microscope-save` commands. Rejected because save/load/delete need current interactive selection state.

## Risks / Trade-offs

- Selection refactor can regress grep duplicate-row toggling → keep row-key tests and add path-selection tests for duplicate grep hits.
- Loaded saved paths may no longer exist → retain paths for insertion, show unknown estimate count, and keep picker usable.
- Corrupt storage file can break picker startup → validate JSON and surface a warning/error without mutating editor text.
- `alt+` key support can vary by terminal → make saved-set action keys configurable and test config parsing.
- Replacing selection on load may surprise users who expected merge → document behavior in tests/UI; merge can be future follow-up.
- Storing estimate snapshots can drift after files change → recompute estimates when saving/loading where practical, and treat estimates as approximate.

## Migration Plan

1. Add saved-set storage types/helpers and unit tests for missing, valid, duplicate, corrupt, and project-local stores.
2. Add path estimation helpers for saved paths, reusing existing byte/token formatting where possible.
3. Refactor picker selection state to keep insertable reference paths separate from visible row keys.
4. Change picker confirmation output to normalized relative paths and adapt command insertion/notification code.
5. Add save/load/delete action modes and key config parsing.
6. Render saved set count and saved-set row summaries alongside existing selected budget lines.
7. Add command and picker tests across project-file, git-changed, and content grep modes.
8. Run `bun test`, `bun run check-types`, `bun run lint`, and `bun run format:check`.

Rollback: remove saved-set storage/actions and revert picker selection output to candidates. The persisted `.pi/microscope/context-sets.json` file is local data and can be left unused or manually deleted.

## Open Questions

- Final default keybindings should be verified against Pi TUI terminal behavior during implementation; `alt+s`, `alt+l`, and `alt+d` are proposed starting points.
