## Why

Minimal `pi-microscope` file picker now handles single-file insertion, but context assembly often needs several files from one search session. Multi-select lets users build a small working set without reopening `/microscope` for each file.

## What Changes

- Add select/unselect behavior in the existing file picker.
- Show a visible selected-file count while picker is open.
- Make Enter insert every selected file as `@relative/path` references when one or more files are selected.
- Preserve current single-file Enter behavior when no files are selected.
- Keep scope limited to file picker selection and insertion; defer git mode, content mode, prompt-aware ranking, context packs, and configurable insertion templates.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `file-reference-picker`: Adds multi-select file selection and multi-reference prompt insertion behavior to the existing picker.

## Impact

- Affected code: `src/picker.ts`, `src/command.ts`, `src/editor.ts`, and related tests under `test/`.
- Affected behavior: `/microscope` can insert multiple selected file references in one editor update.
- APIs/dependencies: no new runtime dependencies expected; continue using existing pi UI and finder boundaries.
- Validation: implementation must pass `bun test`, `bun run check-types`, `bun run lint`, and `bun run format:check`.
