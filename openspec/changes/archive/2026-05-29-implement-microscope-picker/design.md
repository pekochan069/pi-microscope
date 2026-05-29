## Context

`pi-microscope` currently has a proven spike command, `/microscope-spike-insert`, that appends a fixed `@src/index.ts`-style reference to the prompt editor. The real product goal is a file picker: users type `/microscope [query]`, choose a repository file, and the extension inserts `@relative/path` without losing existing prompt text.

Current constraints:

- Pi extension entrypoint is `index.ts`, re-exporting `src/index.ts` through `package.json` `pi.extensions`.
- Pi command APIs support `pi.registerCommand()`, `ctx.hasUI`, `ctx.ui.select()`, `ctx.ui.notify()`, `ctx.ui.getEditorText()`, and `ctx.ui.setEditorText()`.
- `@ff-labs/fff-node` is installed and already validated in a spike: create, scan, fuzzy search, and `destroy()` work locally.
- Project rule: keep TypeScript functions near or below 100 lines. Avoid one large command handler.
- Existing `src/editor.ts` is pure and tested. It should be reused, not rewritten.

High-level flow:

```text
User prompt editor
      |
      |  /microscope [query]
      v
Pi command handler
      |
      +--> FinderService.search(query)
      |       |
      |       +--> lazy FileFinder.create({ basePath: ctx.cwd })
      |       +--> bounded waitForScan()
      |       +--> fileSearch(query, { pageSize })
      |       +--> FileCandidate[]
      |
      +--> Picker.pickFile(candidates)
      |       |
      |       +--> ctx.ui.select(title, relativePaths)
      |       +--> selected FileCandidate | undefined
      |
      +--> insertPathReference(currentEditorText, selected.relativePath)
              |
              +--> ctx.ui.setEditorText(nextText)
```

## Goals / Non-Goals

**Goals:**

- Add a usable `/microscope [query]` command that inserts selected files as `@file` prompt references.
- Keep native finder lifecycle isolated and cleaned up on session shutdown.
- Preserve existing editor text for empty prompts, existing prose, trailing whitespace, cancellation, no-result, and error paths.
- Make the first implementation boring and testable: `ctx.ui.select()` for selection, pure helpers for mapping and insertion, dependency injection for tests.
- Keep module boundaries small enough that live-search custom UI can be added later without rewriting finder or editor logic.

**Non-Goals:**

- Live fuzzy filtering inside the picker overlay. MVP accepts an initial query argument and uses Pi's built-in selector.
- Multi-select insertion.
- Directory picker mode.
- Content grep or mixed file/content search.
- Persistent frecency tuning beyond what `fff-node` already provides.
- Opening files, line-number references, or editor cursor placement.

## Decisions

### 1. Use Pi's built-in `ctx.ui.select()` for MVP

Recommendation: use `ctx.ui.select()` now, defer custom TUI overlay.

Rationale:

- It proves the core user value with fewer moving parts.
- It uses a stable Pi API and avoids building custom keyboard/focus behavior too early.
- The extension can still expose `/microscope query` to narrow results before selection.

Alternative considered: custom `ctx.ui.custom()` overlay with text input and live search.

- Better UX long-term.
- More test and edge-case surface now: focus handling, debounce, stale async searches, escape/enter behavior, and rendering.
- Should be phase 2 once MVP picker behavior is validated.

### 2. Isolate `fff-node` behind `src/finder.ts`

Recommendation: create a small `FinderService`/adapter module that owns `FileFinder.create()`, `waitForScan()`, `fileSearch()`, and `destroy()`.

```text
src/finder.ts
  ├── FileCandidate          typed data returned to picker/command
  ├── SearchResult union     success | empty | error
  ├── FffFinderService       real fff-node adapter
  └── destroy()              idempotent lifecycle cleanup
```

Rationale:

- Native resource cleanup matters. `FileFinder.destroy()` stops background resources.
- Tests should not instantiate native FFI. An adapter boundary lets tests fake search results and errors.
- Future changes to watch mode, scan timeout, cache settings, or content indexing stay in one file.

Alternative considered: call `FileFinder` directly from command handler.

- Smaller first diff.
- Couples command UI to native error/result shapes.
- Makes tests harder and risks leaking resources on reload/shutdown.

### 3. Keep picker display path-only for the first version

Recommendation: display and return exact `relativePath` strings in `ctx.ui.select()`.

Rationale:

- `ctx.ui.select()` returns a string, not an object.
- Exact relative path gives stable display-to-candidate mapping.
- Avoids parsing fragile labels like `src/index.ts  modified  56B`.

Alternative considered: rich rows with git status, size, or score.

- Useful later.
- Requires either a custom UI component or a separate collision-proof display ID scheme.

### 4. Keep editor logic pure and central

Recommendation: all prompt mutation continues through `insertPathReference(currentText, relativePath)` in `src/editor.ts`.

Rationale:

- Already tested by spike.
- Keeps spacing/path-safety logic in one place.
- Makes command tests assert behavior instead of duplicating string rules.

Alternative considered: inline insertion in `/microscope`.

- Slightly fewer imports.
- Reintroduces the exact class of spacing bugs the spike tests already prevent.

### 5. Register cleanup on session shutdown

Recommendation: create one finder service per extension instance and call `destroy()` from `pi.on("session_shutdown", ...)`.

Rationale:

- Native `FileFinder` instances are resource-owning.
- Shutdown cleanup protects reload and long-running sessions.
- `destroy()` should be idempotent so duplicate cleanup is safe.

Alternative considered: create/destroy finder on every command invocation.

- Simplest lifecycle.
- Slower repeated use and loses watcher/frecency benefits.
- Acceptable fallback if persistent watcher causes issues, but not the first choice.

## Module Plan

```text
src/
  editor.ts          pure @path formatting/insertion, already exists
  finder.ts          fff-node adapter + typed search results
  picker.ts          candidate display + ctx.ui.select selection policy
  command.ts         optional dependency-injected command orchestration
  index.ts           Pi registration only, thin wiring
```

Right-sized implementation:

- If command orchestration stays small, keep it in `src/index.ts`.
- If tests need fake finder + fake picker + fake UI, extract `createMicroscopeHandler()` to `src/command.ts`.
- Do not add `src/types.ts` until shared types spread across 3+ modules.

Suggested command orchestration:

```text
handleMicroscope(args, ctx)
  ├── guard ctx.hasUI
  ├── query = args.trim()
  ├── result = finder.search(query)
  ├── if error -> notify, return
  ├── if empty -> notify, return
  ├── selected = pickFile(ctx.ui, result.candidates)
  ├── if cancelled -> return
  └── setEditorText(insertPathReference(getEditorText(), selected.relativePath))
```

## Risks / Trade-offs

- Native resource leak → Mitigation: finder service owns `destroy()`, command never owns raw native handle, `session_shutdown` cleanup is registered.
- First invocation scan latency → Mitigation: bounded `waitForScan()` and concise `Indexing files...`/error notifications. Search can still return partial results if fff allows it after timeout.
- Built-in selector is not live fuzzy search → Mitigation: `/microscope query` narrows input now; custom overlay remains a phase-2 upgrade behind same finder/picker boundary.
- Duplicate display values → Mitigation: MVP display string is exact `relativePath`, which should be unique per workspace scan.
- Paths with spaces → Mitigation: editor helper preserves spaces inside the path text. If Pi `@file` parsing later requires escaping, fix only `src/editor.ts` and tests.
- Large repos or watch overhead → Mitigation: all fff init options live in `src/finder.ts`; switch `disableWatch` or cache limits without touching UI.
- `fff-node` unavailable or binary missing → Mitigation: finder returns typed error; command notifies user and leaves editor unchanged.

## Test Architecture

Coverage target: all command branches, not only happy path.

```text
CODE PATHS                                           USER FLOWS
[+] src/editor.ts                                    [+] Insert selected file
  ├── [★★★ TESTED] empty prompt                        ├── [GAP] select README -> @README.md
  ├── [★★★ TESTED] prose prompt                        └── [GAP] prose prompt -> prose @file
  ├── [★★★ TESTED] trailing whitespace
  └── [★★★ TESTED] invalid path rejection            [+] Cancel / no result / error
                                                       ├── [GAP] cancel leaves editor unchanged
[+] src/finder.ts                                      ├── [GAP] no match leaves editor unchanged
  ├── [GAP] create success -> candidates               └── [GAP] finder error leaves editor unchanged
  ├── [GAP] create failure -> error
  ├── [GAP] search failure -> error
  └── [GAP] destroy idempotent

[+] src/picker.ts
  ├── [GAP] selected path maps to candidate
  ├── [GAP] cancel returns undefined
  └── [GAP] empty list notifies/returns undefined

[+] src/index.ts / src/command.ts
  ├── [GAP] non-UI mode does not mutate editor
  ├── [GAP] selected result mutates editor once
  ├── [GAP] empty result does not mutate editor
  └── [GAP] finder error does not mutate editor
```

Validation commands:

- `bun test`
- `bun run check-types`
- `bun run lint`
- `bun run format:check`

Manual acceptance:

- `/microscope README` inserts `@README.md`.
- `/microscope src` can select and insert `@src/index.ts`.
- Existing prompt `check this` becomes `check this @path`.
- Empty prompt becomes `@path`.
- Cancel leaves editor unchanged.
- No-match leaves editor unchanged.
- Reload/shutdown does not leave broken finder state.

## Migration Plan

1. Keep the spike command while building `/microscope`, so dogfood remains available.
2. Implement finder, picker, and command tests with fakes before wiring real fff behavior.
3. Wire `/microscope` into `src/index.ts` with real `FffFinderService`.
4. Validate with automated commands and manual dogfood.
5. Remove or explicitly mark `/microscope-spike-insert` as dev-only before release.

Rollback strategy:

- If `/microscope` has runtime issues, keep the pure editor helper and revert only finder/picker command wiring.
- The dependency is already in the lockfile from the spike; if fff proves unstable, remove `src/finder.ts` usage and dependency in a separate cleanup.

## Open Questions

- Should `/microscope-spike-insert` be removed immediately after `/microscope` works, or kept temporarily for manual regression checks?
- Should command argument completions also use fff search in this first implementation, or wait until the main picker is stable?
- Should no-query `/microscope` show all files ranked by fff, or ask for an initial query when repositories exceed a threshold?
