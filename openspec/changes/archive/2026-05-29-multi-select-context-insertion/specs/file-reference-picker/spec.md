## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Test coverage for all command branches

The implementation SHALL include automated tests for editor insertion, finder success/failure behavior, picker selection/cancel behavior, picker multi-select toggle/confirm behavior, and command-level editor mutation behavior.

#### Scenario: Automated validation passes

- **WHEN** `bun test`, `bun run check-types`, `bun run lint`, and `bun run format:check` are executed after implementation
- **THEN** all commands SHALL pass without failures
