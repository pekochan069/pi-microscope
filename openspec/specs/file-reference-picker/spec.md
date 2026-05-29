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

### Requirement: Git-changed picker mode

The extension SHALL provide picker mode controls that switch `/microscope` among project-file candidates, git-changed-file candidates, and content-grep candidates without breaking existing project-file or git-changed selection behavior.

#### Scenario: Opens in project-file mode by default

- **WHEN** an interactive user runs `/microscope src`
- **THEN** the picker SHALL initially show project-file candidates using the existing project-file search behavior

#### Scenario: Toggles to git-changed mode

- **WHEN** an interactive user opens `/microscope` and activates the mode toggle from project-file mode
- **THEN** the picker SHALL show git-changed-file candidates instead of project-file candidates

#### Scenario: Toggles to content grep mode

- **WHEN** an interactive user is viewing git-changed-file candidates and activates the mode toggle
- **THEN** the picker SHALL show content-grep candidates generated from the same query instead of git-changed-file candidates

#### Scenario: Toggles back to project-file mode

- **WHEN** an interactive user is viewing content-grep candidates and activates the mode toggle
- **THEN** the picker SHALL return to project-file candidates using the same query

#### Scenario: Project-file insertion remains unchanged

- **WHEN** an interactive user selects or multi-selects files in project-file mode and presses Enter
- **THEN** the prompt editor SHALL receive the same `@relative/path` references it would have received before content grep mode was added

#### Scenario: Git-changed insertion remains unchanged

- **WHEN** an interactive user selects or multi-selects files in git-changed mode and presses Enter
- **THEN** the prompt editor SHALL receive the same `@relative/path` references it would have received before content grep mode was added

### Requirement: Git-changed file listing

The extension SHALL list modified, added, deleted, and renamed working-tree files in git-changed mode using paths relative to the workspace.

#### Scenario: Shows modified file

- **WHEN** git status reports `src/index.ts` as modified
- **THEN** git-changed mode SHALL include `src/index.ts` with modified status metadata

#### Scenario: Shows added file

- **WHEN** git status reports `src/new.ts` as added or untracked
- **THEN** git-changed mode SHALL include `src/new.ts` with added status metadata

#### Scenario: Shows deleted file

- **WHEN** git status reports `src/old.ts` as deleted
- **THEN** git-changed mode SHALL include `src/old.ts` with deleted status metadata

#### Scenario: Shows renamed file

- **WHEN** git status reports `src/old.ts` renamed to `src/new.ts`
- **THEN** git-changed mode SHALL include `src/new.ts` with renamed status metadata and preserve `src/old.ts` as original-path metadata

#### Scenario: No changed files

- **WHEN** git-changed mode is active and the workspace has no changed files
- **THEN** the picker SHALL show a clear no-changed-files state and SHALL leave the prompt editor unchanged

### Requirement: Git-changed preview

The extension SHALL preview a git-changed candidate when the changed path is readable on disk and SHALL handle unreadable changed paths without crashing.

#### Scenario: Previews readable changed file

- **WHEN** git-changed mode highlights a readable changed file `src/index.ts`
- **THEN** the preview area SHALL show a bounded preview of `src/index.ts`

#### Scenario: Deleted file preview is unavailable

- **WHEN** git-changed mode highlights a deleted file `src/old.ts`
- **THEN** the preview area SHALL show that preview is unavailable because the file is deleted

#### Scenario: Unreadable file preview is unavailable

- **WHEN** git-changed mode highlights a changed file that cannot be read
- **THEN** the preview area SHALL show a preview-unavailable message and SHALL keep the picker usable

### Requirement: Git-changed multi-select insertion

The extension SHALL allow an interactive user to select one or more git-changed files and insert them into the prompt editor as `@relative/path` references.

#### Scenario: Inserts highlighted changed file when none selected

- **WHEN** an interactive user highlights `src/index.ts` in git-changed mode and presses Enter without selecting files
- **THEN** the prompt editor SHALL contain `@src/index.ts` appended with safe spacing and no loss of existing prompt text

#### Scenario: Inserts selected changed files

- **WHEN** an interactive user selects `src/index.ts` and `test/index.test.ts` in git-changed mode and presses Enter
- **THEN** the prompt editor SHALL contain both `@src/index.ts` and `@test/index.test.ts` appended with safe spacing and no loss of existing prompt text

#### Scenario: Inserts renamed target path

- **WHEN** an interactive user selects a renamed candidate whose original path is `src/old.ts` and current path is `src/new.ts`
- **THEN** the prompt editor SHALL contain `@src/new.ts`

#### Scenario: Cancel preserves editor text in git-changed mode

- **WHEN** an interactive user selects one or more git-changed files and then cancels the picker
- **THEN** the prompt editor SHALL remain unchanged

### Requirement: Content grep file-content search

The extension SHALL provide a content grep picker mode that searches repository file contents using the current query.

#### Scenario: Shows content grep matches

- **WHEN** an interactive user opens `/microscope createMicroscopeHandler` and switches to content grep mode
- **THEN** the picker SHALL show matching file-content results whose rows include the relative file path, 1-based matching line number, and matching line snippet

#### Scenario: Empty content grep query

- **WHEN** an interactive user switches to content grep mode with an empty or whitespace-only query
- **THEN** the picker SHALL show a clear prompt to type a search query and SHALL leave the prompt editor unchanged

#### Scenario: No content matches

- **WHEN** an interactive user searches content grep mode for `unlikely-no-match-query`
- **THEN** the picker SHALL show a clear no-content-matches state and SHALL leave the prompt editor unchanged unless the user selects a valid result later

#### Scenario: Content grep failure

- **WHEN** the content grep provider fails while loading results
- **THEN** the picker SHALL report the failure through the existing picker error path and SHALL leave the prompt editor unchanged

### Requirement: Content grep match preview

The extension SHALL preview a content grep result by opening the matched file around the matching line.

#### Scenario: Previews around matching line

- **WHEN** content grep mode highlights a result for `src/command.ts` at line 28
- **THEN** the preview area SHALL show a bounded preview of `src/command.ts` centered near line 28 with displayed line numbers matching the file line numbers

#### Scenario: Preserves normal file previews

- **WHEN** project-file mode or git-changed mode highlights a candidate without match-line metadata
- **THEN** the preview area SHALL keep the existing bounded top-of-file preview behavior

#### Scenario: Match file preview unavailable

- **WHEN** content grep mode highlights a result whose file cannot be read, is binary, exceeds preview limits, or escapes the workspace
- **THEN** the preview area SHALL show a preview-unavailable message and SHALL keep the picker usable

### Requirement: Content grep reference insertion

The extension SHALL insert content grep selections into the prompt editor as deduped `@relative/path` references.

#### Scenario: Inserts highlighted grep file when none selected

- **WHEN** an interactive user highlights a content grep result for `src/command.ts` and presses Enter without selecting any rows
- **THEN** the prompt editor SHALL contain `@src/command.ts` appended with safe spacing and no loss of existing prompt text

#### Scenario: Inserts selected grep files

- **WHEN** an interactive user selects content grep results for `src/command.ts` and `src/picker.ts` and presses Enter
- **THEN** the prompt editor SHALL contain both `@src/command.ts` and `@src/picker.ts` appended with safe spacing and no loss of existing prompt text

#### Scenario: Dedupes multiple grep hits in the same file

- **WHEN** an interactive user selects two content grep rows that both map to `src/command.ts` and presses Enter
- **THEN** the prompt editor SHALL contain exactly one `@src/command.ts` reference for those selected rows

#### Scenario: Cancel with selected grep rows preserves editor text

- **WHEN** an interactive user selects one or more content grep rows and then cancels the picker
- **THEN** the prompt editor SHALL remain unchanged

### Requirement: Deduped reference insertion across picker modes

The extension SHALL dedupe selected relative paths before inserting file references into the prompt editor while preserving the existing append-only spacing behavior.

#### Scenario: Dedupes project-file selections before insertion

- **WHEN** an interactive user confirms a project-file selection containing duplicate relative paths for `src/index.ts`
- **THEN** the prompt editor SHALL contain exactly one `@src/index.ts` reference for those duplicate selections

#### Scenario: Dedupes git-changed selections before insertion

- **WHEN** an interactive user confirms a git-changed selection containing duplicate relative paths for `src/index.ts`
- **THEN** the prompt editor SHALL contain exactly one `@src/index.ts` reference for those duplicate selections

#### Scenario: Dedupes content grep selections before insertion

- **WHEN** an interactive user confirms multiple content grep rows that resolve to `src/index.ts`
- **THEN** the prompt editor SHALL contain exactly one `@src/index.ts` reference for those selected rows

#### Scenario: Preserves insertion order by first selected path occurrence

- **WHEN** an interactive user confirms selected rows resolving to `src/a.ts`, `src/b.ts`, and another `src/a.ts` in that order
- **THEN** the prompt editor SHALL append `@src/a.ts @src/b.ts` in first-occurrence order

