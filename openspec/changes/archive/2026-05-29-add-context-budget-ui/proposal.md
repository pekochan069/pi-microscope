## Why

Large multi-file selections can silently exceed useful prompt context, especially after multi-select, git-changed mode, and content grep mode. Users need budget feedback before inserting references so they can trim selection without changing existing insertion behavior.

## What Changes

- Add context budget UI to `/microscope` picker across project-file, git-changed, and content grep modes.
- Show selected file count for deduped selected paths.
- Show estimated selected file bytes and tokens.
- Show current result file size and token estimate for highlighted result.
- Warn when deduped selection exceeds configurable context budget.
- Dedupe selected paths before estimating and before insertion.
- Preserve current insertion behavior and prompt editor spacing semantics.
- No prompt-aware ranking or saved budget presets in this change.

## Capabilities

### New Capabilities

- `context-budget-ui`: Budget display, estimation, warnings, configuration, and deduplication behavior for selected and highlighted file references.

### Modified Capabilities

- `file-reference-picker`: Selection insertion semantics change to explicitly dedupe selected paths before insertion while preserving existing append-only behavior.

## Impact

- Affected code: `/microscope` picker UI, selection state, candidate providers, file metadata/preview helpers, insertion pipeline, tests.
- Affected modes: project-file, git-changed, content grep.
- Configuration: add a configurable budget value with a sensible default.
- APIs/dependencies: no external dependency changes expected.
