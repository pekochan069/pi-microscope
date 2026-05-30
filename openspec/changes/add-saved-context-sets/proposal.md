## Why

Users can already assemble multi-file context in `/microscope`, but repeated work is lost after insertion or cancellation. Saved context sets let users preserve useful selections per project and reload them later without changing existing `@relative/path` insertion behavior.

## What Changes

- Add named saved context sets for `/microscope` selections.
- Save the current selected files as a named set with deduped normalized paths.
- Load a saved set back into the picker selection, including when current mode/query does not show those files.
- Delete saved sets from the project-local store.
- Persist saved sets per project at `.pi/microscope/context-sets.json`.
- Show saved set count, selected file count, and saved-set estimated bytes/tokens in the picker UI.
- Reuse existing approximate token/byte estimation semantics for saved sets.
- Preserve existing prompt insertion format, spacing, ordering, and dedupe semantics.
- Keep behavior working across project-file, git-changed, and content grep modes.
- Exclude prompt-aware ranking, auto-trimming, and recommendation behavior.

## Capabilities

### New Capabilities

- `saved-context-sets`: Named project-local context sets that can be saved from, loaded into, and deleted from `/microscope` selections with persisted deduped paths and estimates.

### Modified Capabilities

_None._

## Impact

- Affected source: `src/picker.ts`, `src/command.ts`, `src/config.ts`, new saved-set storage/helper module, and tests under `test/`.
- Storage: creates or updates `.pi/microscope/context-sets.json` inside the active project/workspace.
- UI: adds picker keybindings/actions and status lines for saved-set management and counts.
- Data model: selection state must support path-based loaded selections in addition to visible row-key toggles for grep results.
- Compatibility: no change to existing `@relative/path` insertion behavior, finder/git/grep search semantics, or budget warning config.
