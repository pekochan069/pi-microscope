## Context

`/microscope` now supports project-file, git-changed, and content grep modes with multi-select. Current UI shows selected row count but not context cost, and grep results can produce several selectable rows for one file. Insertion already appends `@relative/path` references through the existing editor helper; this change adds budget awareness without changing that append behavior.

## Goals / Non-Goals

**Goals:**

- Display selected file count using deduped file paths, not raw selected rows.
- Display estimated bytes and tokens for deduped selected files.
- Display highlighted result file size and token estimate.
- Warn when selected estimate exceeds configurable budget.
- Apply consistently across project-file, git-changed, and content grep modes.
- Dedupe selected paths before estimating and before insertion.
- Keep prompt editor insertion spacing and reference format unchanged.

**Non-Goals:**

- Prompt-aware ranking or automatic selection trimming.
- Saved budget presets.
- Exact tokenizer integration.
- Reading deleted/unreadable files to compute live size.
- Changing finder, git status, or grep search semantics.

## Decisions

- **Use candidate metadata as primary estimate source.** `FileCandidate.size` already exists for project and grep results, and git-changed candidates can carry size/readability metadata. This avoids file reads during render and keeps picker responsive. Alternative: read each selected file on every render; rejected because render should stay cheap and deleted/unreadable files need graceful handling.

- **Use approximate token estimator.** Estimate tokens from bytes with a deterministic heuristic such as `ceil(bytes / 4)`. This is fast, dependency-free, and good enough for warning users about budget scale. Alternative: add model-specific tokenizers; rejected as out of scope and dependency-heavy.

- **Add explicit budget config under `piMicroscope.contextBudget`.** Config should include `maxTokens` with a default that is useful but conservative. Keep this separate from preview limits because preview bounds control UI rendering while budget controls selected context cost. Alternative: reuse preview maxBytes; rejected because preview and prompt budget are different concerns.

- **Centralize budget summary helpers outside TUI component rendering.** Pure helpers should compute deduped selected paths, total bytes/tokens, highlighted file estimate, and over-budget state from candidates/options. This makes tests straightforward and avoids coupling estimation logic to terminal rendering. Alternative: inline calculation in `render`; rejected because behavior must be tested across modes.

- **Dedupe by normalized reference path before estimating and inserting.** Content grep row keys remain unique for selection toggling, but budget/insertion should collapse multiple rows from same file to one `@path`. Alternative: dedupe by row key; rejected because it overcounts grep hits and inserts duplicates.

## Risks / Trade-offs

- **Approximate tokens may differ from model tokenizer** → Label estimates as approximate and test deterministic output.
- **Deleted or unreadable git-changed files lack meaningful size** → Treat missing/unknown size as 0 or unknown in summary, and keep UI usable.
- **Large selected sets could make render expensive** → Compute from candidate metadata only; avoid filesystem reads in render path.
- **Config shape can drift from docs/tests** → Add config parsing tests for defaults, valid overrides, and invalid warnings.
- **Deduping selected paths can reduce inserted count vs selected row count** → UI must show deduped file count so behavior is visible before insertion.

## Migration Plan

1. Add context budget options and defaults.
2. Add pure estimation/deduplication helpers with unit tests.
3. Pass budget options into picker options.
4. Render budget summary and warning line in picker header/body.
5. Ensure command insertion continues using deduped normalized paths.
6. Run `bun test`, `bun run check-types`, `bun run lint`, and `bun run format:check`.

Rollback: remove budget option parsing and picker summary rendering; existing selection/insertion helpers remain compatible.

## Open Questions

- Default `maxTokens` value should be chosen during implementation; proposed starting point: 24,000 approximate tokens.
