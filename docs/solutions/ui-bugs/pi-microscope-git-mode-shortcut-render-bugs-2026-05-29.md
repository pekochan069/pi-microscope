---
title: Pi microscope git mode shortcut render bug fixes
date: 2026-05-29
category: ui-bugs
module: pi-microscope
problem_type: ui_bug
component: tooling
symptoms:
  - "Git changed mode showed `Bun is not defined` and preview fallback text"
  - "Ctrl+F did not open the microscope picker"
  - "Git changed mode stayed on a loading message after switching modes"
root_cause: logic_error
resolution_type: code_fix
severity: medium
related_components:
  - development_workflow
  - assistant
tags:
  - pi-extension
  - pi-microscope
  - git-mode
  - keyboard-shortcuts
  - terminal-input
  - async-render
  - bun-spawn
  - picker-ui
---

# Pi microscope git mode shortcut render bug fixes

## Problem

`pi-microscope` added git-changed mode, configurable shortcuts, and file previews, but dogfooding exposed three runtime/UI bugs: git mode failed in Pi with `Bun is not defined`, `ctrl+f` did not open the picker, and git mode appeared to load forever after switching modes.

## Symptoms

- Git mode displayed `Bun is not defined` and the preview area fell back to `Preview unavailable`.
- Pressing `ctrl+f` in the prompt editor moved the cursor instead of opening microscope.
- Pressing `ctrl+g` inside the picker changed state to `Loading Git changed…` but the overlay did not update when candidates finished loading.

## What Didn't Work

- Relying on Bun globals in extension runtime. `bun test` passed, but Pi extension runtime did not expose global `Bun`.
- Relying only on `pi.registerShortcut("ctrl+f", ...)`. Pi already binds `ctrl+f` to `tui.editor.cursorRight`, so the extension shortcut was skipped or lost to the editor.
- Updating picker component state after an async candidate load without explicitly requesting a TUI render. The data loaded, but the overlay stayed visually stale until another input caused a render.

## Solution

### Use Node process APIs in extension runtime

Keep Bun for tests and scripts, but avoid `Bun.*` globals in extension code that Pi loads. `src/git.ts` now shells out through Node `execFile`:

```ts
execFile(
  "git",
  ["-C", basePath, "status", "--porcelain=v1", "-z", "--untracked-files=all"],
  { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  (error, stdout, stderr) => {
    if (error) {
      resolveStatus({ ok: false, error: stderr.trim() || error.message });
      return;
    }

    resolveStatus({ ok: true, stdout });
  },
);
```

`GitChangedService.search()` still owns git parsing and returns the same typed `FileSearchResult`, so picker and command code do not know how git status is executed.

### Capture the shortcut before editor cursor handling

`src/index.ts` keeps `pi.registerShortcut()` for non-conflicting bindings, but also installs a raw terminal input listener on session start for the configured shortcut:

```ts
const shortcut = loaded.options.shortcut;
if (shortcut === false) return;

unsubscribeTerminalInput = ctx.ui.onTerminalInput((data) => {
  if (isPickerOpen || !matchesKey(data, shortcut)) return undefined;
  void openMicroscope("", ctx);
  return { consume: true };
});
```

`isPickerOpen` prevents nested picker creation. This matters because `ctrl+f` also means “switch to project-file mode” inside the picker.

### Request a render after async mode loads

`src/picker.ts` now accepts a render callback from the Pi custom UI factory:

```ts
new MultiSelectPickerComponent(
  query,
  loadCandidates,
  initial.candidates,
  options,
  done,
  () => tui.requestRender(true),
);
```

Mode switching requests a render when loading begins and again when candidates or errors resolve:

```ts
const requestId = ++this.requestId;
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
```

The existing `requestId` guard still protects against stale async results if users switch modes quickly.

## Why This Works

- `execFile` is available in Pi's Node/Jiti extension runtime; no global Bun dependency is required.
- Raw terminal input capture runs before editor cursor handling, so `ctrl+f` can open microscope even though Pi uses the same chord for cursor-right.
- Explicit render requests connect async state mutation to the TUI lifecycle. Loading state, success state, and empty/error states all become visible without waiting for another keypress.
- Keeping git execution behind `GitStatusExecutor` preserves testability and isolates runtime-specific process execution.

## Prevention

- Treat Pi extension runtime code as Node-compatible TypeScript. Use Bun commands for project scripts/tests, but avoid `Bun.*` globals in loaded extension modules unless Pi explicitly guarantees them.
- For extension shortcuts that overlap built-in editor bindings, pair `registerShortcut()` with an `onTerminalInput()` fallback and return `{ consume: true }` when handled.
- Any custom TUI component that mutates state after `await` should call `tui.requestRender(true)` or receive an equivalent render invalidator.
- Keep the `requestId` stale-result guard when picker mode switches can overlap.
- Dogfood in the actual Pi runtime after Bun tests pass; shortcut handling and render lifecycle bugs often do not appear in unit tests.

## Related Issues

- Related doc: `docs/solutions/architecture-patterns/pi-microscope-file-reference-picker-2026-05-29.md` covers the base picker architecture and multi-select context insertion pattern.
- Related OpenSpec: `openspec/changes/add-git-changed-mode/` contains the git-mode, preview, and shortcut feature plan.
