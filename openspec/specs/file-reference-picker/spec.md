# file-reference-picker Specification

## Purpose

TBD - created by archiving change implement-microscope-picker. Update Purpose after archive.
## Requirements
### Requirement: File picker command

The extension SHALL provide a `/microscope` command that lets an interactive user select a repository file and insert it into the prompt editor as an `@relative/path` reference.

#### Scenario: Selects and inserts a file reference

- **WHEN** an interactive user runs `/microscope README` and selects `README.md`
- **THEN** the prompt editor SHALL contain `@README.md` appended with safe spacing and no loss of existing prompt text

#### Scenario: Uses an optional initial query

- **WHEN** an interactive user runs `/microscope src`
- **THEN** the file choices SHALL be filtered or ranked using `src` as the initial fuzzy query

#### Scenario: Empty query is allowed

- **WHEN** an interactive user runs `/microscope` with no arguments
- **THEN** the command SHALL present repository file choices using the finder default ordering

### Requirement: Editor text preservation

The extension SHALL preserve existing prompt editor text when inserting a selected file reference.

#### Scenario: Empty prompt insertion

- **WHEN** the prompt editor is empty and the user inserts `src/index.ts`
- **THEN** the prompt editor SHALL become `@src/index.ts`

#### Scenario: Existing prompt insertion

- **WHEN** the prompt editor contains `hello` and the user inserts `src/index.ts`
- **THEN** the prompt editor SHALL become `hello @src/index.ts`

#### Scenario: Existing trailing whitespace insertion

- **WHEN** the prompt editor contains `hello ` and the user inserts `src/index.ts`
- **THEN** the prompt editor SHALL become `hello @src/index.ts`

#### Scenario: Repeated insertion

- **WHEN** the prompt editor already contains `@README.md` and the user inserts `src/index.ts`
- **THEN** the prompt editor SHALL become `@README.md @src/index.ts`

### Requirement: Safe cancellation and failure behavior

The command SHALL leave the prompt editor unchanged when the user cancels selection, no files match, the finder fails, or UI is unavailable.

#### Scenario: User cancels file selection

- **WHEN** the user opens `/microscope src` and cancels the picker without selecting a file
- **THEN** the prompt editor SHALL remain unchanged

#### Scenario: No matching files

- **WHEN** the user runs `/microscope unlikely-no-match-query` and no repository files match
- **THEN** the prompt editor SHALL remain unchanged and the user SHALL receive a no-results notification

#### Scenario: Finder initialization fails

- **WHEN** the file finder cannot initialize because its native binary or base path is unavailable
- **THEN** the prompt editor SHALL remain unchanged and the user SHALL receive an error notification

#### Scenario: Non-interactive mode

- **WHEN** `/microscope` is invoked while interactive UI is unavailable
- **THEN** the prompt editor SHALL remain unchanged and the command SHALL report that interactive UI is required

### Requirement: Finder lifecycle management

The extension SHALL manage native finder resources through a single lifecycle boundary and clean them up when the session shuts down.

#### Scenario: Finder is created lazily

- **WHEN** the extension loads but `/microscope` has not been invoked
- **THEN** the native file finder SHALL NOT be created yet

#### Scenario: Finder is reused across command invocations

- **WHEN** the user runs `/microscope` multiple times in the same session and the finder remains healthy
- **THEN** the extension SHALL reuse the existing finder service instead of creating a new native finder each time

#### Scenario: Finder is destroyed on shutdown

- **WHEN** the Pi session shuts down or the extension is reloaded
- **THEN** the extension SHALL call the finder service cleanup path so native resources are released

### Requirement: Test coverage for all command branches

The implementation SHALL include automated tests for editor insertion, finder success/failure behavior, picker selection/cancel behavior, picker multi-select toggle/confirm behavior, and command-level editor mutation behavior.

#### Scenario: Automated validation passes

- **WHEN** `bun test`, `bun run check-types`, `bun run lint`, and `bun run format:check` are executed after implementation
- **THEN** all commands SHALL pass without failures

### Requirement: Multi-select context insertion

The extension SHALL allow an interactive user to select and unselect multiple repository files in one `/microscope` picker session and insert all selected files into the prompt editor as `@relative/path` references.

#### Scenario: Selects multiple files and inserts all references

- **WHEN** an interactive user runs `/microscope src`, selects `src/index.ts` and `src/finder.ts`, and presses Enter
- **THEN** the prompt editor SHALL contain both `@src/index.ts` and `@src/finder.ts` appended with safe spacing and no loss of existing prompt text

#### Scenario: Shows selected count

- **WHEN** an interactive user selects two files in the picker
- **THEN** the picker SHALL visibly show that 2 files are selected before insertion

#### Scenario: Unselects a selected file

- **WHEN** an interactive user selects `README.md` and then unselects `README.md` before pressing Enter
- **THEN** `@README.md` SHALL NOT be inserted because it is no longer selected

#### Scenario: Enter preserves single-file behavior when nothing is selected

- **WHEN** an interactive user runs `/microscope README`, highlights `README.md`, and presses Enter without selecting any files
- **THEN** the prompt editor SHALL contain `@README.md` appended with safe spacing and no loss of existing prompt text

#### Scenario: Cancel with selected files preserves editor text

- **WHEN** an interactive user selects one or more files and then cancels the picker
- **THEN** the prompt editor SHALL remain unchanged

### Requirement: Batch editor text preservation

The extension SHALL insert multiple selected file references with the same append-only spacing guarantees used for single-file insertion.

#### Scenario: Empty prompt batch insertion

- **WHEN** the prompt editor is empty and the user inserts `src/index.ts` and `src/finder.ts`
- **THEN** the prompt editor SHALL become `@src/index.ts @src/finder.ts`

#### Scenario: Existing prompt batch insertion

- **WHEN** the prompt editor contains `inspect` and the user inserts `src/index.ts` and `src/finder.ts`
- **THEN** the prompt editor SHALL become `inspect @src/index.ts @src/finder.ts`

#### Scenario: Existing trailing whitespace batch insertion

- **WHEN** the prompt editor contains `inspect ` and the user inserts `src/index.ts` and `src/finder.ts`
- **THEN** the prompt editor SHALL become `inspect @src/index.ts @src/finder.ts`

