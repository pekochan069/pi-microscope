---
title: Pi microscope saved context sets pattern
date: 2026-05-30
category: developer-experience
module: pi-microscope
problem_type: developer_experience
component: tooling
severity: medium
applies_when:
  - "Adding reusable file groups to picker-driven agent context insertion"
  - "Persisting context selections that must work across project, git-changed, and content grep views"
  - "Loading saved selections whose files may not be visible in the current picker results"
related_components:
  - assistant
  - development_workflow
  - testing_framework
tags:
  - pi-extension
  - pi-microscope
  - saved-context-sets
  - file-reference-picker
  - picker-state
  - context-budget
  - content-grep
  - project-local-storage
---

# Pi microscope saved context sets pattern

## Context

`pi-microscope` helps users build agent working sets by finding files and inserting `@relative/path` references into the prompt editor. After multi-select, git-changed mode, content grep mode, and budget UI, the next friction was repetition: the same file groups had to be rebuilt manually each time.

Prior session history framed this as context packs or saved presets for fast agent working-set assembly, with examples like `project`, `git-changed`, `tests`, `docs`, and `recent` (session history). The implemented version keeps that product direction but scopes it to explicit named context sets that persist per project.

## Guidance

Treat saved context sets as durable normalized paths, not saved picker rows.

### Store sets per project

Relative paths only mean something inside one repository. Persist saved sets under the project root, not global user settings.

```txt
.pi/microscope/context-sets.json
```

Use a small versioned store so the persisted shape is explicit.

```ts
export interface ContextSetsFile {
  version: 1;
  sets: SavedContextSet[];
}

export interface SavedContextSet {
  name: string;
  paths: string[];
  bytes: number;
  approxTokens: number;
  unknownFileCount: number;
  updatedAt: string;
}
```

Missing stores should read as empty. Corrupt or invalid stores should also fall back to empty so a bad local cache does not break `/microscope`.

```ts
export function getContextSetsPath(projectRoot: string): string {
  return join(projectRoot, ".pi", "microscope", "context-sets.json");
}

const emptyContextSets = (): ContextSetsFile => ({ version: 1, sets: [] });

export function loadContextSets(projectRoot: string): ContextSetsFile {
  const path = getContextSetsPath(projectRoot);
  if (!existsSync(path)) return emptyContextSets();

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parseContextSetsFile(parsed) ?? emptyContextSets();
  } catch {
    return emptyContextSets();
  }
}
```

### Normalize and dedupe before persisting

Persist insertable references, not raw UI values. Reuse the same reference normalization semantics as editor insertion so saved data cannot escape the workspace.

```ts
export function normalizeSavedPaths(relativePaths: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const path of relativePaths) {
    const reference = normalizePathReference(path);
    if (seen.has(reference)) continue;
    seen.add(reference);
    normalized.push(reference);
  }

  return normalized;
}
```

That gives first-occurrence dedupe across project-file rows, git-changed rows, and duplicate grep matches.

### Split visible selection from insertable selection

Picker row identity and saved context identity are different things.

```ts
interface PickerState {
  mode: PickerMode;
  highlightedIndex: number;
  selectedRowKeys: Set<string>;
  selectedReferencePaths: string[];
}
```

Keep `selectedRowKeys` for visible UI state. Grep mode can show several rows for one file, and users should be able to toggle rows independently. Keep `selectedReferencePaths` for the deduped files that will be saved, budgeted, or inserted.

This split also lets saved sets load even when paths are not in the current candidate list.

```ts
export function replaceSelectionWithPaths(
  state: PickerState,
  paths: string[],
  candidates: FileCandidate[],
): PickerState;
```

When a saved set loads, replace path selection and mark any currently visible rows that match. Off-screen or off-mode paths remain selected because they live in `selectedReferencePaths`.

```ts
const state = replaceSelectionWithPaths(createPickerState(), ["src/offscreen.ts"], candidates);
confirmPickerSelection(state, candidates);
// => ["src/offscreen.ts"]
```

### Keep editor mutation centralized

Save, load, and delete are picker actions. They must not mutate the prompt editor. Only final confirmation should call the existing insertion helper.

```ts
const contextSets: ContextSetActions = {
  list: () => loadContextSets(projectRoot).sets,
  save: (name, paths) => saveContextSet(projectRoot, name, paths),
  delete: (name) => deleteContextSet(projectRoot, name),
};

insertReferencesIntoEditor(ctx, selectedPaths);
```

This preserves existing append-only spacing and dedupe behavior.

```txt
before: inspect
loaded: ["src/index.ts", "src/finder.ts"]
after:  inspect @src/index.ts @src/finder.ts
```

### Estimate saved sets when writing

Saved sets should display size before insertion, but files may be deleted or unreadable later. Count those as unknown instead of blocking the set.

```ts
estimateSavedPaths(projectRoot, paths);
// => { bytes, approxTokens, unknownFileCount }
```

Render list rows with enough context to choose safely.

```txt
ui • 2 files • 4 KB • ~1.0k tokens
api • 3 files • 9 KB • ~2.3k tokens • 1 unknown size
```

## Why This Matters

Saved context sets are a developer-experience feature, but the failure modes are state-model failures. If you persist row keys, loaded sets break whenever the user changes mode, query, or provider. If you persist global paths, the same set name can point at unrelated files in another project. If save/load/delete shares the final insertion path, cancellation can mutate the prompt unexpectedly.

Separating durable normalized paths from transient row keys keeps the picker predictable:

- project-file mode saves normal file results
- git-changed mode saves changed file paths, including rename targets
- content grep mode can select multiple matching rows but still save one file path
- loaded sets can insert files that are not visible under the current query
- prompt mutation still happens once, through the existing editor helper

## When to Apply

Use this pattern when building picker-backed context tools where:

- selections need names and persistence
- persisted paths are project-relative
- the current view is only one projection of possible files
- result rows are not stable durable identifiers
- duplicate rows can resolve to the same final file reference
- loading a saved selection should not immediately mutate the destination editor

Avoid it for simple one-shot pickers where there is no persistence and no cross-mode loading.

## Examples

Save a set with normalized, deduped paths:

```ts
saveContextSet(projectRoot, "ui", ["./src/picker.ts", "src/picker.ts"]);
// Stores: ["src/picker.ts"]
```

Delete a set by name:

```ts
deleteContextSet(projectRoot, "ui");
// true when a set was removed
```

Load a saved set into current picker selection:

```ts
this.state = replaceSelectionWithPaths(this.state, selectedSet.paths, this.candidates);
```

Keep no-saved-set actions predictable:

```ts
component.handleInput("alt+l");
// notify: "No saved context sets exist"
// selection unchanged
```

Default shortcuts are configurable:

```ts
const keys = {
  saveContextSet: ["alt+s"],
  loadContextSet: ["alt+l"],
  deleteContextSet: ["alt+d"],
};
```

## Related

- `docs/solutions/developer-experience/pi-microscope-context-budget-ui-2026-05-30.md` — saved sets reuse the same byte/token estimate semantics and cross-provider budget expectations.
- `docs/solutions/architecture-patterns/pi-microscope-file-reference-picker-2026-05-29.md` — base command/picker/editor boundary that saved sets extend.
- `docs/solutions/ui-bugs/pi-microscope-picker-query-typing-bug-2026-05-29.md` — picker input and reload behavior to keep in mind when adding action modes.
- `docs/solutions/ui-bugs/pi-microscope-git-mode-shortcut-render-bugs-2026-05-29.md` — runtime shortcut and render dogfooding lessons for picker extensions.
