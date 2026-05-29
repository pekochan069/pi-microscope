---
title: Pi microscope picker query typing bug
date: 2026-05-29
category: ui-bugs
module: pi-microscope
problem_type: ui_bug
component: tooling
symptoms:
  - "Custom picker opened but typing printable characters did not update the search query"
  - "Backspace could not edit the picker query"
  - "Content grep mode could not receive a search term from inside the picker"
root_cause: logic_error
resolution_type: code_fix
severity: medium
related_components:
  - "development_workflow"
  - "assistant"
tags:
  - "pi-extension"
  - "pi-microscope"
  - "picker-ui"
  - "keyboard-input"
  - "content-grep"
  - "search-query"
---

# Pi microscope picker query typing bug

## Problem

`pi-microscope` custom TUI picker opened and accepted control keys, but ignored printable text input. Users could move, select, switch modes, and cancel, but could not type a search query inside the overlay.

This became obvious while dogfooding content grep mode: grep mode could be entered, but no search term could be typed from inside the picker.

## Symptoms

- Typing letters in the picker did nothing.
- Header query stayed unchanged.
- Candidate list did not reload for typed search terms.
- Backspace could not edit the query.
- Navigation and mode keys still worked, so terminal input wiring was not fully broken.

## What Didn't Work

- Existing `handleInput()` only matched configured control keys: up/down, project mode, git mode, grep mode, mode toggle, selection toggle, confirm, and cancel.
- The component stored the initial query as a `readonly` constructor parameter, so it could display an initial query but not mutate it after the picker opened.
- Async candidate reload existed only for mode changes, not query changes.
- Prior session history only confirmed intended picker UX: users should type after the picker opens and fuzzy-search project files. It showed no previous attempted fix for this exact typing failure (session history).

## Solution

Make the picker query mutable, handle printable input and Backspace after control keys, and reload the current mode whenever the query changes.

### Make query mutable

```ts
constructor(
  private query: string,
  private readonly loadCandidates: LoadCandidates,
  initialCandidates: FileCandidate[],
  private readonly options: PickFilesOptions,
  private readonly done: (value: FileCandidate[] | undefined) => void,
  private readonly requestRender: () => void = () => {},
) {
  this.state = createPickerState(options.initialMode);
  this.candidates = initialCandidates;
}
```

### Handle text editing after control keys

```ts
if (matchesAny(data, this.options.keys.cancel)) {
  this.done(undefined);
  return;
}

if (isBackspace(data)) {
  if (this.query.length === 0) return;
  this.query = this.query.slice(0, -1);
  void this.reloadCandidates();
  return;
}

const text = getPrintableInput(data);
if (text) {
  this.query += text;
  void this.reloadCandidates();
}
```

### Reload candidates for the active mode

```ts
private async reloadCandidates(): Promise<void> {
  const requestId = ++this.requestId;
  const mode = this.state.mode;
  this.state = { ...this.state, highlightedIndex: 0, selectedPaths: new Set() };
  this.candidates = [];
  this.message = `Loading ${PICKER_MODE_LABELS[mode]}…`;
  this.requestRender();

  const result = await this.loadCandidates(mode, this.query);
  if (requestId !== this.requestId) return;

  if (result.status === "ok") {
    this.candidates = result.candidates;
    this.message = "";
    this.requestRender();
    return;
  }

  this.candidates = [];
  this.message = result.message;
  this.requestRender();
}
```

### Classify printable input conservatively

```ts
function isBackspace(data: string): boolean {
  return data === "\u007f" || data === "\b";
}

function getPrintableInput(data: string): string | undefined {
  if (data.length === 0) return undefined;
  if ([...data].some((char) => char < " " || char === "\u007f")) return undefined;
  return data;
}
```

### Add regression coverage

```ts
test("typing updates query and reloads current mode", async () => {
  const calls: Array<{ mode: string; query: string }> = [];
  const component = new MultiSelectPickerComponent(
    "",
    async (mode, query) => {
      calls.push({ mode, query });
      return ok(candidates.filter((candidate) => candidate.relativePath.includes(query)));
    },
    candidates,
    { initialMode: "project-files", keys: DEFAULT_MICROSCOPE_OPTIONS.keys },
    () => {},
  );

  component.handleInput("s");
  await Promise.resolve();
  expect(component.render(80)[0]).toContain("Query: s");

  component.handleInput("r");
  await Promise.resolve();
  expect(component.render(80)[0]).toContain("Query: sr");

  component.handleInput("\u007f");
  await Promise.resolve();
  expect(component.render(80)[0]).toContain("Query: s");
  expect(calls).toEqual([
    { mode: "project-files", query: "s" },
    { mode: "project-files", query: "sr" },
    { mode: "project-files", query: "s" },
  ]);
});
```

## Why This Works

- Control keys still run first, so existing navigation, mode switching, selection, confirm, and cancel behavior stays unchanged.
- Printable input now mutates the component query instead of being ignored.
- Backspace edits the same mutable query and triggers the same reload path.
- `reloadCandidates()` reuses the active mode, so project-file, git-changed, and content-grep modes all stay query-aware.
- Highlight and selection reset when the query changes because the result identity may have changed.
- The existing `requestId` guard prevents stale async search results from overwriting newer typed-query results.
- Explicit render requests keep loading and resolved states visible after async work completes.

## Prevention

- Test custom TUI components with printable text input, not only control keys.
- Keep input handling order explicit: movement/mode/select/confirm/cancel first, then text editing.
- Treat picker search query as mutable UI state when the overlay supports in-place search.
- Any async query or mode reload should clear stale candidates, reset selection/highlight, show loading state, guard stale requests, and request render after completion.
- Dogfood actual Pi runtime for “can type into overlay” before shipping picker/search UI.

## Related Issues

- Related bug doc: `docs/solutions/ui-bugs/pi-microscope-git-mode-shortcut-render-bugs-2026-05-29.md` covers shortcut capture, async render, and git runtime failures in the same picker area.
- Related pattern doc: `docs/solutions/architecture-patterns/pi-microscope-file-reference-picker-2026-05-29.md` covers the file reference picker structure and multi-select context insertion pattern.
- GitHub issue search for `pi-microscope picker typing keyboard` returned no related issues.
