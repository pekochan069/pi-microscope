## Context

`pi-microscope` currently has a project-file picker backed by `FffFinderService`, a custom TUI multi-select list, and append-only `@relative/path` insertion. The picker receives one precomputed candidate list, so changing modes inside the overlay requires moving search/loading responsibility behind a small mode boundary.

Git-changed mode targets the next context-assembly workflow: inspect and insert files from the current working tree diff. Scope is limited to changed-file paths, readable previews, existing multi-select semantics, and deterministic insertion. It does not add content grep, prompt-aware ranking, token budgeting, or context packs.

## Goals / Non-Goals

**Goals:**

- Add an in-picker toggle between project-file mode and git-changed mode.
- Show modified, added, deleted, and renamed working-tree files in git-changed mode.
- Preserve project-file search, selection, cancellation, and insertion behavior.
- Reuse existing multi-select and batch insertion behavior for changed files.
- Preview readable changed files safely, while deleted/unreadable files render a non-fatal preview message.
- Cover mode behavior with unit tests and run the repo validation commands.

**Non-Goals:**

- No content grep mode.
- No prompt-aware ranking.
- No token budgeting.
- No saved presets or config UI.
- No diff hunk viewer; preview is file content or a clear unavailable state only.

## Decisions

### Use a small picker mode boundary

Add a `PickerMode`/provider boundary with two modes: `project-files` and `git-changed`. The command should pass the initial query plus a `loadCandidates(mode, query)` function into the picker instead of resolving one candidate list before UI opens.

Rationale: mode toggle needs to reload candidates while preserving one overlay session, selection state, and Enter behavior. This is smaller than a full provider platform but leaves a seam for later grep/recent modes.

Alternative considered: add a second `/microscope-changed` command. Rejected because user asked for a mode toggle and because future presets should live in one picker.

### Source git-changed files from `git status --porcelain=v1 -z`

Implement a `GitChangedService` boundary that shells out to `git -C <basePath> status --porcelain=v1 -z --untracked-files=all` and parses status records into `FileCandidate` objects.

Rationale: `@ff-labs/fff-node` exposes `gitStatus` metadata on indexed files, but deleted files may not exist in the index and rename source/target handling is status-specific. Porcelain `-z` is stable and machine-parseable, covers modified/added/deleted/renamed/untracked paths, and avoids new dependencies.

Alternative considered: filter `fileSearch()` results by `gitStatus !== "clean"`. Rejected because it cannot reliably list deleted files and may miss rename metadata.

### Represent changed paths with explicit metadata

Extend `FileCandidate` or introduce a compatible changed-file candidate shape with:

- `relativePath`: path inserted into the prompt; for renamed files, use the new path.
- `fileName`: basename of `relativePath`.
- `gitStatus`: display/status label.
- `changeType`: `modified | added | deleted | renamed`.
- `originalPath?`: rename source path when available.
- `readable`: false for deleted paths and true/unknown for paths that may be previewed.

Rationale: existing picker and editor code already operate on `relativePath`; extra metadata supports display and preview without changing insertion helpers.

Alternative considered: encode rename/deleted state into `gitStatus` only. Rejected because preview and tests need normalized behavior independent from raw git status letters.

### Keep query filtering path-only in git-changed mode

In git-changed mode, apply the existing command query to changed-file paths only. Use simple case-insensitive subsequence or substring matching if no existing fuzzy helper is available. Empty query lists all changed files in git status order grouped by status priority only if that remains simple.

Rationale: changed file sets are usually small, and user explicitly deferred content grep and prompt-aware ranking.

Alternative considered: feed changed paths back into `fff-node` ranking. Rejected because deleted paths are not indexable and consistency across all changed statuses matters more than advanced scoring here.

### Preview reads from the workspace with guardrails

Add a `PreviewService` that accepts `basePath` and `relativePath`, normalizes through existing path rules, rejects workspace escapes, reads only regular readable files, and caps bytes/lines. Deleted or unreadable changed files should return a preview status such as “Preview unavailable: file deleted” instead of throwing through render.

Rationale: preview must not crash the picker, and changed mode includes paths that may not exist on disk.

Alternative considered: use git blob/diff preview. Rejected for this change because scope says readable file preview, not diff hunk rendering.

### Reset selection per mode

When toggling modes, reset highlighted index and selected paths for the new candidate list.

Rationale: a selected project-file path should not silently carry into changed mode. This avoids accidental insertion of files not visible in the current mode.

Alternative considered: preserve selections across modes. Rejected for now; cross-mode context packs are future scope.

## Risks / Trade-offs

- Git command unavailable or not a repository → Return typed empty/error state and leave project-file mode usable.
- Porcelain parsing mistakes around renames → Add focused tests for modified, added, deleted, untracked, and renamed `-z` records.
- Project-file behavior regression from picker refactor → Keep existing command/editor/picker tests and add project-mode regression tests.
- Preview introduces file I/O during render → Load preview through explicit async state/request id, or compute on selection change with stale-result guard if UI supports invalidation.
- Deleted files can be selected but not previewed → Show explicit deleted preview state and still insert their relative paths, matching scope.

## Migration Plan

1. Add mode/search/preview types without removing existing APIs.
2. Refactor command and picker to support candidate loading per mode while preserving current project-file tests.
3. Add git-changed service and porcelain parser tests.
4. Add changed-mode picker tests for toggle, listing, preview states, multi-select, and insertion.
5. Run `bun test`, `bun run check-types`, `bun run lint`, and `bun run format:check`.
6. Rollback is code-only: remove the new mode provider/service and keep existing project-file path.

## Open Questions

- Exact toggle key should avoid future text-entry conflicts; initial recommendation is `Ctrl-G` because current picker already reserves control-key navigation.
- If project-file preview is already expected by dogfood but not implemented, decide whether to share preview UI across both modes or keep this change limited to git-changed mode.
