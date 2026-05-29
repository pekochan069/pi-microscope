# context-budget-ui Specification

## Purpose
TBD - created by archiving change add-context-budget-ui. Update Purpose after archive.
## Requirements
### Requirement: Selected context budget summary

The picker SHALL show a context budget summary for the deduped file paths that would be inserted if the user confirmed the current selection.

#### Scenario: Shows empty selection budget

- **WHEN** an interactive user opens `/microscope` and has not selected any files
- **THEN** the picker SHALL show zero selected files and zero estimated selected tokens

#### Scenario: Shows deduped selected count

- **WHEN** an interactive user selects two rows that resolve to the same relative file path
- **THEN** the picker SHALL count them as one selected file in the context budget summary

#### Scenario: Shows selected bytes and tokens

- **WHEN** an interactive user selects readable files with known sizes
- **THEN** the picker SHALL show estimated total bytes and approximate tokens for the deduped selected files

### Requirement: Highlighted result context estimate

The picker SHALL show the current highlighted result file size and approximate token estimate when candidate size metadata is available.

#### Scenario: Shows highlighted project file estimate

- **WHEN** project-file mode highlights `src/index.ts` with known size metadata
- **THEN** the picker SHALL show that file's estimated bytes and approximate tokens

#### Scenario: Shows highlighted git-changed file estimate

- **WHEN** git-changed mode highlights a changed file with known size metadata
- **THEN** the picker SHALL show that file's estimated bytes and approximate tokens

#### Scenario: Shows highlighted grep file estimate

- **WHEN** content grep mode highlights a grep match whose file has known size metadata
- **THEN** the picker SHALL show that file's estimated bytes and approximate tokens

#### Scenario: Handles unknown highlighted size

- **WHEN** the highlighted result has no usable size metadata
- **THEN** the picker SHALL show that the highlighted file size estimate is unavailable and SHALL remain usable

### Requirement: Configurable context budget warning

The extension SHALL provide a configurable selected-context token budget and warn when deduped selected file estimates exceed it.

#### Scenario: Uses default token budget

- **WHEN** no context budget setting is configured
- **THEN** the picker SHALL compare selected approximate tokens against the default budget

#### Scenario: Uses configured token budget

- **WHEN** `piMicroscope.contextBudget.maxTokens` is configured to a positive integer
- **THEN** the picker SHALL compare selected approximate tokens against that configured value

#### Scenario: Warns above budget

- **WHEN** deduped selected file estimates exceed the active context budget
- **THEN** the picker SHALL show a visible warning before insertion

#### Scenario: Does not warn within budget

- **WHEN** deduped selected file estimates are less than or equal to the active context budget
- **THEN** the picker SHALL not show an over-budget warning

#### Scenario: Invalid budget config warning

- **WHEN** `piMicroscope.contextBudget.maxTokens` is configured with a non-positive integer or non-integer value
- **THEN** config loading SHALL keep the default budget and report a warning

### Requirement: Cross-mode budget consistency

Context budget summaries and warnings SHALL work consistently in project-file, git-changed, and content grep modes.

#### Scenario: Project-file mode selection updates budget

- **WHEN** an interactive user selects or unselects project-file mode candidates
- **THEN** the selected context budget summary SHALL update to reflect the deduped selected project files

#### Scenario: Git-changed mode selection updates budget

- **WHEN** an interactive user selects or unselects git-changed mode candidates
- **THEN** the selected context budget summary SHALL update to reflect the deduped selected changed files

#### Scenario: Content grep mode selection updates budget

- **WHEN** an interactive user selects or unselects content grep mode candidates
- **THEN** the selected context budget summary SHALL update to reflect the deduped selected grep files

#### Scenario: Mode switch clears budget selection

- **WHEN** an interactive user switches picker modes and selection state is cleared
- **THEN** the selected context budget summary SHALL reset to zero selected files and zero estimated selected tokens

