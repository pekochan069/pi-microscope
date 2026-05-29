## 1. Finder Service

- [x] 1.1 Add `src/finder.ts` with `FileCandidate`, typed search result union, and finder service interface.
- [x] 1.2 Implement `FffFinderService` with lazy `FileFinder.create({ basePath, aiMode: true, disableContentIndexing: true })` initialization.
- [x] 1.3 Add bounded `waitForScan()` behavior that does not throw if indexing times out.
- [x] 1.4 Map `fff-node` `fileSearch()` results into stable `FileCandidate` objects with `relativePath`, `fileName`, `gitStatus`, `size`, and score when available.
- [x] 1.5 Implement idempotent `destroy()` and guard search after destroy with a typed error result.
- [x] 1.6 Add finder tests using a fake native adapter for create success, create failure, search failure, scan timeout, and idempotent destroy.

## 2. Picker Layer

- [x] 2.1 Add `src/picker.ts` with a `pickFile(ui, candidates, query)` helper using `ctx.ui.select()`.
- [x] 2.2 Display exact `relativePath` strings so selected values map back to candidates without parsing rich labels.
- [x] 2.3 Handle empty candidate lists with a no-results notification and `undefined` return.
- [x] 2.4 Handle selection cancellation with `undefined` return and no editor mutation.
- [x] 2.5 Add picker tests for selected path, cancellation, empty list, and duplicate-safety expectations.

## 3. Command Wiring

- [x] 3.1 Add a `/microscope` command in `src/index.ts` with optional query argument support.
- [x] 3.2 Guard non-interactive mode with a clear notification and no editor mutation.
- [x] 3.3 Wire command flow: search files, pick candidate, insert selected `@relative/path` with `insertPathReference()`, then `setEditorText()`.
- [x] 3.4 Register `session_shutdown` cleanup to call the finder service `destroy()` path.
- [x] 3.5 Extract `src/command.ts` only if dependency-injected command tests would otherwise make `src/index.ts` too coupled or near the 100-line function rule.
- [x] 3.6 Decide whether to keep or remove `/microscope-spike-insert` after `/microscope` passes manual dogfood.

## 4. Command Tests

- [x] 4.1 Add command-level tests with fake UI, fake finder, and fake picker dependencies.
- [x] 4.2 Test selected-result path mutates editor exactly once and preserves existing prompt text.
- [x] 4.3 Test cancel path leaves editor unchanged.
- [x] 4.4 Test no-result path leaves editor unchanged and notifies the user.
- [x] 4.5 Test finder-error path leaves editor unchanged and notifies the user.
- [x] 4.6 Test non-UI mode leaves editor unchanged and reports interactive UI requirement.

## 5. Manual Dogfood and Validation

- [x] 5.1 Run `bun test`.
- [x] 5.2 Run `bun run check-types`.
- [x] 5.3 Run `bun run lint`.
- [x] 5.4 Run `bun run format:check`.
- [x] 5.5 Dogfood `/microscope README` and verify it inserts `@README.md`.
- [x] 5.6 Dogfood `/microscope src` and verify selecting `src/index.ts` inserts `@src/index.ts`.
- [x] 5.7 Dogfood cancellation/no-match behavior and verify existing prompt text is unchanged.
- [x] 5.8 Reload the extension and verify `/microscope` still works without stale finder state.

## 6. Follow-up Scope Capture

- [x] 6.1 Add TODOs or a follow-up OpenSpec change for live fuzzy overlay if built-in select UX feels too weak.
- [x] 6.2 Add TODOs or a follow-up OpenSpec change for multi-select only after single-select usage is stable.
- [x] 6.3 Add TODOs or a follow-up OpenSpec change for command argument completions if the MVP picker is stable and completion latency is acceptable.
