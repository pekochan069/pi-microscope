---
title: Pi microscope context budget UI pattern
date: 2026-05-30
category: developer-experience
module: pi-microscope
problem_type: developer_experience
component: tooling
severity: medium
applies_when:
  - "Adding context-cost feedback to file pickers or assistant context insertion flows"
  - "Extending one picker UI across project, git-changed, and content grep providers"
  - "Using file metadata to warn before users insert too much context"
related_components:
  - assistant
  - development_workflow
  - testing_framework
tags:
  - pi-extension
  - pi-microscope
  - context-budget
  - picker-ui
  - token-estimation
  - git-changed
  - multi-select
  - bun-test
---

# Pi microscope context budget UI pattern

## Context

`pi-microscope` already supported project-file selection, multi-select, git-changed mode, and content grep mode. The missing developer-experience piece was budget awareness: users could select several files or multiple grep rows without seeing how many bytes or approximate tokens they were about to add to agent context.

The OpenSpec change `add-context-budget-ui` added that feedback while preserving existing `@relative/path` insertion behavior. Session history showed token-cost estimates were part of the original future direction for the picker, but prompt-aware ranking and saved presets remained out of scope.

## Guidance

Treat context budget UI as a cross-layer feature, not a render-only tweak. Budget UI needs candidate sizes, pure summary helpers, config defaults, picker rendering, and insertion regression tests.

### Keep budget math pure

Put byte/token math and deduplication in a standalone helper so tests do not need terminal rendering.

```ts
export function byteCountToApproxTokens(bytes: number): number {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  return Math.ceil(bytes / 4);
}

export function dedupeCandidatesByRelativePath(candidates: FileCandidate[]): FileCandidate[] {
  const seen = new Set<string>();
  const deduped: FileCandidate[] = [];

  for (const candidate of candidates) {
    const key = normalizePathReference(candidate.relativePath);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
}
```

This keeps token estimates deterministic and makes grep duplicate rows easy to test: selected rows can stay independently toggleable, while budget and insertion collapse to one file reference.

### Parse budget config separately from preview config

Preview limits and context budget limits control different things. Keep them separate in configuration.

```ts
export interface MicroscopeContextBudgetOptions {
  maxTokens: number;
}

export interface MicroscopeOptions {
  shortcut: KeyId | false;
  initialMode: PickerMode;
  pageSize: number;
  keys: MicroscopeKeys;
  preview: MicroscopePreviewOptions;
  contextBudget: MicroscopeContextBudgetOptions;
}
```

Validate `piMicroscope.contextBudget.maxTokens` as a positive integer and preserve the default on invalid input.

### Render selected and highlighted cost in the picker

The picker should show two related numbers:

- selected deduped file count, known readable bytes, approximate tokens, active budget
- highlighted result bytes and approximate tokens

```ts
const selected = `Context: ${budget.selected.fileCount} files • ${formatBytes(
  budget.selected.bytes,
)} • ~${formatApproxTokens(budget.selected.approxTokens)} / ~${formatApproxTokens(
  budget.maxTokens,
)}`;

const highlighted = budget.highlighted
  ? `Highlighted: ${formatBytes(budget.highlighted.bytes)} • ~${formatApproxTokens(
      budget.highlighted.approxTokens,
    )}`
  : "Highlighted: size unavailable";
```

Warn without blocking when the selected estimate exceeds the configured budget:

```ts
if (budget.isOverBudget) {
  lines.push("⚠ Selection exceeds context budget");
}
```

### Audit every provider that feeds the shared picker

Budget UI correctness depends on `FileCandidate.size` plus `readable` metadata. Project-file and grep candidates already came from finder metadata, but git-changed candidates initially used `size: 0` and needed readable/file-size enrichment.

The fix was to enrich readable git-changed candidates with filesystem size metadata after parsing `git status`:

```ts
export function withChangedFileSizes(
  candidates: FileCandidate[],
  basePath: string,
): FileCandidate[] {
  return candidates.map((candidate) => {
    if (candidate.readable === false) return candidate;

    try {
      const stats = statSync(join(basePath, candidate.relativePath));
      if (!stats.isFile()) return { ...candidate, readable: false };
      return { ...candidate, size: stats.size, readable: true };
    } catch {
      return { ...candidate, readable: false };
    }
  });
}
```

Deleted or unreadable files stay usable in the picker; highlighted size renders as unavailable, and selected byte/token totals count only candidates with a valid readable size estimate.

### Keep insertion behavior unchanged

Budget UI should not change prompt mutation semantics. Command code still inserts deduped normalized paths through the existing editor helper:

```ts
const currentText = ctx.ui.getEditorText();
const nextText = insertPathReferences(currentText, dedupeRelativePaths(relativePaths));
ctx.ui.setEditorText(nextText);
```

That preserves append-only spacing while making duplicate grep hits or duplicate selected candidates insert only one `@path`.

## Why This Matters

Context pickers are part of agent working-set assembly. If selected files exceed useful context, users need to know before insertion, not after the prompt becomes bloated. A cheap approximate estimate is enough to prevent most mistakes, but only if every picker mode feeds trustworthy metadata.

The important review lesson: UI tests alone can pass while provider fixtures encode the same bug as production code. Add provider-level tests for metadata that the UI depends on.

## When to Apply

- Adding token, byte, or cost summaries to picker selections.
- Sharing one UI across multiple candidate providers.
- Adding grep rows where several selections can map to the same file.
- Warning before agent context insertion without blocking user control.
- Extending `FileCandidate` metadata that downstream UI trusts.

## Examples

Good test coverage spans pure helpers, config, picker render, command insertion, and provider metadata.

```ts
test("summarizes selected candidates, highlighted candidate, and over-budget state", () => {
  const summary = createContextBudgetSummary({
    selectedCandidates: [first, duplicateFirst, second],
    highlightedCandidate: second,
    maxTokens: 4,
  });

  expect(summary.selected.fileCount).toBe(2);
  expect(summary.selected.bytes).toBe(20);
  expect(summary.selected.approxTokens).toBe(5);
  expect(summary.isOverBudget).toBe(true);
});
```

```ts
test("populates size metadata for readable changed files", async () => {
  writeFileSync(join(dir, "changed.ts"), "12345678");
  const service = new GitChangedService(dir, async () => ({
    ok: true,
    stdout: " M changed.ts\0 D deleted.ts\0",
  }));

  const result = await service.search("");

  expect(result).toEqual({
    status: "ok",
    candidates: [
      expect.objectContaining({ relativePath: "changed.ts", size: 8, readable: true }),
      expect.objectContaining({ relativePath: "deleted.ts", size: 0, readable: false }),
    ],
  });
});
```

Validation for this change used:

- `bun test` — 80 passing tests
- `bun run check-types`
- `bun run lint`
- `bun run format:check`

## Related

- `docs/solutions/architecture-patterns/pi-microscope-file-reference-picker-2026-05-29.md` — base picker boundaries: finder service, picker state, command orchestration, editor mutation.
- `docs/solutions/ui-bugs/pi-microscope-git-mode-shortcut-render-bugs-2026-05-29.md` — git mode and async render lessons; relevant because budget UI depends on git-changed candidates.
- `docs/solutions/ui-bugs/pi-microscope-picker-query-typing-bug-2026-05-29.md` — picker input and reload-state lessons.
