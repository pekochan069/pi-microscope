## ADDED Requirements

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

## MODIFIED Requirements

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
