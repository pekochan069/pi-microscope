## Why

Project-file mode now covers basic context assembly, but the next common agent workflow is “show me what changed in this working tree.” Git-changed mode lets users select changed files directly without scanning or remembering modified paths.

## What Changes

- Add a mode toggle between project files and git-changed files inside `/microscope`.
- List working-tree changed files in git-changed mode, including modified, added, deleted, and renamed files.
- Keep preview available for changed files that are readable on disk.
- Preserve multi-select behavior in git-changed mode.
- Make Enter insert selected changed files as `@relative/path` references using existing safe spacing and path normalization.
- Keep project-file mode behavior unchanged.
- Defer content grep, prompt-aware ranking, token budgeting, and broader context-pack behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `file-reference-picker`: Adds git-changed mode selection, preview, multi-select, and insertion behavior to the existing picker.

## Impact

- Affected code: `src/finder.ts`, `src/picker.ts`, `src/command.ts`, `src/index.ts`, preview-related code if present or added, and tests under `test/`.
- Affected behavior: `/microscope` gains a mode toggle while preserving existing project-file search and insertion behavior.
- APIs/dependencies: use existing `@ff-labs/fff-node` git status support or an equivalent local git-status boundary; no new runtime dependency expected.
- Validation: implementation must pass `bun test`, `bun run check-types`, `bun run lint`, and `bun run format:check`.
