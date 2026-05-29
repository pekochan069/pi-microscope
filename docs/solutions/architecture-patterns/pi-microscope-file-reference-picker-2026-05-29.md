---
title: Pi microscope file reference picker pattern
date: 2026-05-29
category: architecture-patterns
module: pi-microscope
problem_type: architecture_pattern
component: tooling
severity: medium
applies_when:
  - "Adding a Pi slash command that inserts file references into the prompt editor"
  - "Combining native file search with Pi UI selection"
  - "Mutating prompt editor content only after explicit user selection"
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
  - fff-node
  - prompt-editor
  - lifecycle-cleanup
  - bun-test
---

# Pi microscope file reference picker pattern

## Context

`pi-microscope` needed to move from a fixed-path spike to a real `/microscope [query]` command that helps users build agent working sets quickly. Earlier same-day product exploration framed the goal as clean agent context insertion, not a generic Telescope clone: type a command, fuzzy-find a project file, then insert `@relative/path` into the prompt editor (session history).

The final MVP used OpenSpec change `implement-microscope-picker`, kept the UI scope intentionally small, and verified these flows:

- `/microscope README` inserts `@README.md`.
- `/microscope src` can select `src/index.ts` and insert `@src/index.ts`.
- Cancel/no-match paths leave prompt text unchanged.
- Extension reload does not leave stale finder state.

## Guidance

Keep three concerns separate for Pi commands that search files and mutate the prompt editor:

1. Isolate search behind a typed service.
2. Keep picker selection separate from editor mutation.
3. Route prompt text formatting through a pure editor helper.

Add lifecycle cleanup when the service owns native resources.

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

### Keep picker display stable

For `ctx.ui.select()` MVPs, display exact `relativePath` values. This avoids parsing rich labels back into candidates.

```ts
const options = candidates.map((candidate) => candidate.relativePath);
const selectedPath = await ui.select(title, options);
if (!selectedPath) return undefined;

return candidates.find((candidate) => candidate.relativePath === selectedPath);
```

Ensure option labels stay unique; exact relative paths satisfy this for normal workspace file results.

### Mutate the editor only after selection

The command should not call `setEditorText()` until the finder succeeded and the user selected a candidate.

```ts
const selected = await pickFile(ctx.ui, result.candidates, query);
if (!selected) return;

insertReferenceIntoEditor(ctx, selected.relativePath);
```

The text transform stays pure, while the editor wrapper owns the side effect:

```ts
const currentText = ctx.ui.getEditorText();
const nextText = insertPathReference(currentText, relativePath);
ctx.ui.setEditorText(nextText);
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
});
```

Remove spike commands once the real command passes manual dogfood. Keeping both creates stale behavior and user confusion.

## Why This Matters

Native finder libraries add failure modes that plain command handlers should not own: initialization errors, scan timing, result-shape changes, and resource cleanup. A service boundary contains those risks and makes tests independent from native binaries.

Built-in `ctx.ui.select()` is enough for the MVP. Prior sessions proposed richer features such as previews, multi-select, related-files mode, token estimates, git badges, and presets (session history). Those are valid future directions, but the first implementation proved the core value without custom focus handling, debounce, or stale async search bugs.

Dependency-injected command orchestration keeps every branch cheap to test:

- selected file mutates editor exactly once
- cancel path leaves editor unchanged
- no-result path leaves editor unchanged and notifies
- finder-error path leaves editor unchanged and notifies
- non-UI path leaves editor unchanged and reports interactive UI requirement

## When to Apply

Use this pattern when a Pi extension command:

- searches repository files or other native/indexed resources
- asks the user to choose one result
- mutates prompt editor text
- has cancellation/error paths that must not mutate user input
- owns a native resource that must be cleaned up on session shutdown
- needs command-level tests without a live UI or native dependency

## Examples

### Module split example

```text
src/
  editor.ts    pure @path formatting/insertion
  finder.ts    native fff-node adapter + typed results
  picker.ts    ctx.ui.select mapping policy, if selection logic needs its own seam
  command.ts   dependency-injected command orchestration
  index.ts     Pi registration + shutdown cleanup

test/
  editor.test.ts
  finder.test.ts
  picker.test.ts
  command.test.ts
```

For very small commands, `picker.ts` and `command.ts` can stay combined until the test seam or function-size rule says otherwise.

### Validation checklist

```sh
bun test
bun run check-types
bun run lint
bun run format:check
```

Manual dogfood before marking the OpenSpec change complete:

- `/microscope README` inserts `@README.md`.
- `/microscope src` inserts `@src/index.ts` after selection.
- cancel and no-match preserve existing prompt text.
- reload the extension and run `/microscope` again to catch stale finder state.

## Related

- `openspec/specs/file-reference-picker/spec.md` — durable acceptance requirements.
- `openspec/changes/archive/2026-05-29-implement-microscope-picker/design.md` — full implementation design and trade-offs.
- `openspec/changes/archive/2026-05-29-implement-microscope-picker/tasks.md` — completed task checklist.
- `src/finder.ts`, `src/picker.ts`, `src/command.ts`, `src/editor.ts`, `src/index.ts` — implementation boundaries.
