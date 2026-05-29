---
title: Pi microscope file reference picker pattern
date: 2026-05-29
last_updated: 2026-05-29
category: architecture-patterns
module: pi-microscope
problem_type: architecture_pattern
component: tooling
severity: medium
applies_when:
  - "Adding a Pi slash command that inserts file references into the prompt editor"
  - "Combining native file search with Pi UI selection"
  - "Adding multi-select flows to picker-driven context insertion"
  - "Batching editor mutations to avoid partial context insertion"
  - "Cleaning native resources on Pi session shutdown"
related_components:
  - assistant
  - development_workflow
  - testing_framework
tags:
  - pi-extension
  - pi-microscope
  - slash-command
  - file-reference-picker
  - multi-select
  - prompt-editor
  - lifecycle-cleanup
  - bun-test
---

# Pi microscope file reference picker pattern

## Context

`pi-microscope` needed to move from a fixed-path spike to a real `/microscope [query]` command that helps users build agent working sets quickly. Earlier same-day product exploration framed the goal as clean agent context insertion, not a generic Telescope clone: type a command, fuzzy-find a project file, then insert `@relative/path` into the prompt editor (session history).

The first MVP proved single-file insertion. The next feature, OpenSpec change `multi-select-context-insertion`, kept the same module boundaries and evolved the picker from one selected candidate to a selected candidate list. Manual dogfood verified that users can toggle multiple files, see `Selected: N`, and press Enter once to append all selected `@relative/path` references.

## Guidance

Keep five concerns explicit for Pi commands that search files and mutate the prompt editor:

1. Isolate search behind a typed service.
2. Keep picker selection separate from editor mutation.
3. Route prompt text formatting through a pure editor helper.
4. Batch editor mutation through one text transform and one `setEditorText()` call.
5. Add lifecycle cleanup when the service owns native resources.

### Isolate native finder code

Keep `@ff-labs/fff-node` in one module. The command should only see typed search results, not native result shapes or handles.

```ts
export type FileSearchResult =
  | { status: "ok"; candidates: FileCandidate[] }
  | { status: "empty"; message: string }
  | { status: "error"; message: string };

export interface FinderService {
  search(query: string): Promise<FileSearchResult>;
  destroy(): void;
}
```

Create the native finder lazily with AI-friendly options:

```ts
const created = this.adapter.create({
  basePath: this.basePath,
  aiMode: true,
  disableContentIndexing: true,
});
```

Make scan waiting bounded and non-fatal. Search can still return current or partial index results after a timeout.

```ts
private async waitForScan(finder: NativeFinder): Promise<void> {
  try {
    await finder.waitForScan(this.scanTimeoutMs);
  } catch {
    // Search can still return partial/current index results after scan timeout/failure.
  }
}
```

### Keep picker identity stable

For `ctx.ui.select()` MVPs, display exact `relativePath` values. This avoids parsing rich labels back into candidates.

```ts
const options = candidates.map((candidate) => candidate.relativePath);
const selectedPath = await ui.select(title, options);
if (!selectedPath) return undefined;

return candidates.find((candidate) => candidate.relativePath === selectedPath);
```

For multi-select custom UI, preserve the same identity rule even when rendered rows include markers or highlight prefixes. Store selected paths in state, render rich rows from state, and return original `FileCandidate` objects.

```ts
export interface PickerState {
  highlightedIndex: number;
  selectedPaths: Set<string>;
}

export function confirmPickerSelection(
  state: PickerState,
  candidates: FileCandidate[],
): FileCandidate[] | undefined {
  if (state.selectedPaths.size > 0) {
    return candidates.filter((candidate) => state.selectedPaths.has(candidate.relativePath));
  }

  const highlighted = candidates[state.highlightedIndex];
  return highlighted ? [highlighted] : undefined;
}
```

This keeps `Enter` backward-compatible: if nothing is selected, Enter inserts the highlighted file just like the original single-select flow.

### Use custom UI only when interaction needs it

Built-in `ctx.ui.select()` is enough for one-item selection. Multi-select needs Space toggles, visible selected count, and Enter confirmation independent of row selection, so use a small `ctx.ui.custom()` overlay/component for that case.

Keep the first custom picker intentionally narrow:

- Up/Down and Ctrl-N/Ctrl-P move highlight.
- Space toggles selected/unselected state for the highlighted file.
- Header shows `Selected: N`.
- Rows show `[x]` or `[ ]` markers.
- Enter inserts selected files, or highlighted file when none are selected.
- Esc/Ctrl-C cancels without editor mutation.
- No git/content/prompt-aware modes, previews, token estimates, or presets in the same change.

Example render:

```text
Select files for "src" • Selected: 2
────────────────────────────────────────
> [x] src/editor.ts
  [ ] src/command.ts
  [x] src/picker.ts
────────────────────────────────────────
↑↓/Ctrl-N/P move • Space select/unselect • Enter insert • Esc cancel
```

### Batch editor text formatting in a pure helper

Single-file insertion and multi-file insertion should share one formatting path.

```ts
export function insertPathReferences(currentText: string, relativePaths: string[]): string {
  if (relativePaths.length === 0) {
    throw new Error("At least one path reference is required");
  }

  const references = relativePaths.map((path) => `@${normalizePathReference(path)}`).join(" ");

  if (currentText.length === 0 || /\s$/.test(currentText)) {
    return `${currentText}${references}`;
  }

  return `${currentText} ${references}`;
}

export function insertPathReference(currentText: string, relativePath: string): string {
  return insertPathReferences(currentText, [relativePath]);
}
```

The helper guarantees:

- `"" + ["src/index.ts", "src/finder.ts"]` -> `@src/index.ts @src/finder.ts`
- `"inspect" + [...]` -> `inspect @src/index.ts @src/finder.ts`
- `"inspect " + [...]` -> `inspect @src/index.ts @src/finder.ts`
- every path is normalized before insertion
- invalid or empty batches fail before editor mutation

### Mutate the editor only after confirmed selection

The command should not call `setEditorText()` until the finder succeeded and the user confirmed a candidate list.

```ts
const selected = await pickFiles(ctx.ui, result.candidates, query);
if (!selected) return;

try {
  insertReferencesIntoEditor(
    ctx,
    selected.map((candidate) => candidate.relativePath),
  );
} catch (error) {
  ctx.ui.notify(`Could not insert file references: ${getErrorMessage(error)}`, "error");
  return;
}
```

The side effect stays one-shot:

```ts
const currentText = ctx.ui.getEditorText();
const nextText = insertPathReferences(currentText, relativePaths);
ctx.ui.setEditorText(nextText);
```

Use count-aware notifications:

```ts
if (candidates.length === 1) {
  return `Inserted @${normalizePathReference(candidates[0]!.relativePath)}`;
}

return `Inserted ${candidates.length} file references`;
```

### Wire command lifecycle in `src/index.ts`

Create the finder lazily from `ctx.cwd`, not module load time, and clean it up on shutdown.

```ts
let finder: FffFinderService | undefined;

pi.registerCommand("microscope", {
  description: "Select a repository file and append it as an @file reference",
  handler: async (args, ctx) => {
    finder ??= new FffFinderService(ctx.cwd);
    await createMicroscopeHandler({ finder })(args, ctx);
  },
});

pi.on("session_shutdown", () => {
  finder?.destroy();
  finder = undefined;
});
```

Remove spike commands once the real command passes manual dogfood. Keeping both creates stale behavior and user confusion.

## Why This Matters

Native finder libraries add failure modes that plain command handlers should not own: initialization errors, scan timing, result-shape changes, and resource cleanup. A service boundary contains those risks and makes tests independent from native binaries.

The first implementation proved the core value with `ctx.ui.select()`. The multi-select evolution proves the next important product loop: context assembly is faster when users can select several related files in one picker session instead of reopening `/microscope` repeatedly.

Pure picker state helpers keep custom UI safe. The UI can get richer, but the behavior is still easy to test:

- selected files are tracked by exact `relativePath`
- unselect removes paths from state
- Enter returns selected candidates in candidate order
- Enter with no selected paths returns the highlighted candidate
- cancel returns `undefined`

Dependency-injected command orchestration keeps every branch cheap to test:

- selected file mutates editor exactly once
- selected files mutate editor exactly once
- cancel/no-result/error paths leave editor unchanged
- non-UI path reports interactive UI requirement

## When to Apply

Use this pattern when a Pi extension command:

- searches repository files or other native/indexed resources
- asks the user to choose one or more results
- mutates prompt editor text
- has cancellation/error paths that must not mutate user input
- owns a native resource that must be cleaned up on session shutdown
- needs command-level tests without a live UI or native dependency
- can express multi-select as local picker state and a final list of references

Do not use the multi-select change as an excuse to add unrelated modes. Git-aware filtering, content search, prompt-aware ranking, token estimates, presets, and previews are separate features with their own acceptance tests.

## Examples

### Module split example

```text
src/
  editor.ts    pure @path formatting/insertion, including batch insertion
  finder.ts    native fff-node adapter + typed results
  picker.ts    selection UI plus pure picker state helpers
  command.ts   dependency-injected command orchestration
  index.ts     Pi registration + shutdown cleanup

test/
  editor.test.ts
  finder.test.ts
  picker.test.ts
  command.test.ts
```

For very small commands, `picker.ts` and `command.ts` can stay combined until the test seam or function-size rule says otherwise.

### Test coverage shape

Use behavior-facing tests, not terminal-driving tests, for most coverage:

- pure editor tests for single and batch insertion spacing
- pure picker-state tests for movement, toggle, unselect, count, and confirm fallback
- command tests with injected `pickFiles` results for one-shot editor mutation and no-mutation error paths

### Validation checklist

```sh
bun test
bun run check-types
bun run lint
bun run format:check
```

Manual dogfood before marking the OpenSpec change complete:

- `/microscope README` inserts `@README.md` when no files are selected and README is highlighted.
- `/microscope src` lets Space select/unselect several files.
- `Selected: N` changes while toggling files.
- Enter inserts all selected paths in one editor update.
- Escape cancels and preserves existing prompt text.
- reload the extension and run `/microscope` again to catch stale finder state.

## Related

- `openspec/specs/file-reference-picker/spec.md` — durable acceptance requirements.
- `openspec/changes/archive/2026-05-29-implement-microscope-picker/design.md` — original single-file implementation design and trade-offs.
- `openspec/changes/archive/2026-05-29-implement-microscope-picker/tasks.md` — original completed task checklist.
- `openspec/changes/multi-select-context-insertion/design.md` — multi-select design and trade-offs.
- `openspec/changes/multi-select-context-insertion/specs/file-reference-picker/spec.md` — multi-select acceptance criteria before archive.
- `openspec/changes/multi-select-context-insertion/tasks.md` — completed multi-select implementation checklist.
- `src/finder.ts`, `src/picker.ts`, `src/command.ts`, `src/editor.ts`, `src/index.ts` — implementation boundaries.
