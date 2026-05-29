## ADDED Requirements

### Requirement: Git-changed picker mode

The extension SHALL provide a picker mode toggle that switches `/microscope` between project-file candidates and git-changed-file candidates without breaking existing project-file selection behavior.

#### Scenario: Opens in project-file mode by default

- **WHEN** an interactive user runs `/microscope src`
- **THEN** the picker SHALL initially show project-file candidates using the existing project-file search behavior

#### Scenario: Toggles to git-changed mode

- **WHEN** an interactive user opens `/microscope` and activates the mode toggle
- **THEN** the picker SHALL show git-changed-file candidates instead of project-file candidates

#### Scenario: Toggles back to project-file mode

- **WHEN** an interactive user is viewing git-changed-file candidates and activates the mode toggle again
- **THEN** the picker SHALL return to project-file candidates using the same query

#### Scenario: Project-file insertion remains unchanged

- **WHEN** an interactive user selects or multi-selects files in project-file mode and presses Enter
- **THEN** the prompt editor SHALL receive the same `@relative/path` references it would have received before git-changed mode was added

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
