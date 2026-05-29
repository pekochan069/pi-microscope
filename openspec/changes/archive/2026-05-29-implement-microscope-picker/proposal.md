## Why

Pi users need a fast way to add repository file references to the prompt without leaving the editor, manually typing paths, or relying on shell output. The spike proved `ctx.ui.getEditorText()` + `ctx.ui.setEditorText()` works, so now the extension can graduate from fixed-path insertion to an actual picker.

## What Changes

- Add a `/microscope [query]` command that opens an interactive file picker and inserts the selected file as an `@relative/path` reference into the prompt editor.
- Search repository files with `@ff-labs/fff-node` through a small lifecycle-managed finder service.
- Reuse the existing editor insertion helper for prompt-safe spacing and relative-path validation.
- Add a picker layer using Pi's built-in `ctx.ui.select()` for MVP, with architecture that can later upgrade to a live custom TUI overlay.
- Add tests for finder success/failure handling, picker selection/cancel paths, and command-level editor mutation behavior.
- Keep `/microscope-spike-insert` only as temporary dogfood scaffolding until `/microscope` is verified, then remove it before release unless deliberately documented as dev-only.

## Capabilities

### New Capabilities

- `file-reference-picker`: Interactive command for selecting repository files and inserting `@file` references into the prompt editor.

### Modified Capabilities

None.

## Impact

- Affected code: `src/index.ts`, new `src/finder.ts`, new `src/picker.ts`, existing `src/editor.ts`, and matching test files.
- Dependencies: uses existing `@ff-labs/fff-node` dependency added during the spike.
- User-facing API: new slash command `/microscope [query]`.
- Runtime systems: native `FileFinder` instance lifecycle must be explicitly cleaned up with `destroy()` on extension shutdown.
