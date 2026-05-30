## ADDED Requirements

### Requirement: Project-local saved context set storage

The extension SHALL persist saved context sets in `.pi/microscope/context-sets.json` relative to the active project/workspace, not in global Pi settings.

#### Scenario: Missing project store starts empty

- **WHEN** an interactive user opens `/microscope` in a project without `.pi/microscope/context-sets.json`
- **THEN** the picker SHALL treat saved context sets as empty and remain usable

#### Scenario: Saves to project-local storage path

- **WHEN** an interactive user saves a context set in project `/repo`
- **THEN** the extension SHALL create or update `/repo/.pi/microscope/context-sets.json`

#### Scenario: Project stores are independent

- **WHEN** an interactive user saves a context set named `api` in `/repo-a` and opens `/microscope` in `/repo-b`
- **THEN** `/repo-b` SHALL NOT show the `api` set unless `/repo-b/.pi/microscope/context-sets.json` also contains it

#### Scenario: Stored paths are normalized and deduped

- **WHEN** a saved set is created from selected rows that resolve to `src/index.ts`, `./src/index.ts`, and `src/app.ts`
- **THEN** the persisted set SHALL contain `src/index.ts` and `src/app.ts` once each, in first-occurrence order

### Requirement: Saved context set creation

The picker SHALL let an interactive user save the current explicit file selection as a named context set.

#### Scenario: Saves selected project files

- **WHEN** an interactive user selects `src/index.ts` and `src/picker.ts` in project-file mode and saves them as `ui`
- **THEN** the project store SHALL contain a set named `ui` with paths `src/index.ts` and `src/picker.ts`

#### Scenario: Saves selected git-changed files

- **WHEN** an interactive user selects `src/index.ts` in git-changed mode and saves it as `changed`
- **THEN** the project store SHALL contain a set named `changed` with path `src/index.ts`

#### Scenario: Saves deduped content grep files

- **WHEN** an interactive user selects two content grep rows that both resolve to `src/command.ts` and saves them as `command`
- **THEN** the project store SHALL contain one `src/command.ts` path for the `command` set

#### Scenario: Rejects empty selection save

- **WHEN** an interactive user tries to save a context set with zero explicitly selected files
- **THEN** the extension SHALL leave the project store unchanged and notify the user that at least one file must be selected

#### Scenario: Rejects empty set name

- **WHEN** an interactive user starts saving a selected context set and confirms an empty or whitespace-only name
- **THEN** the extension SHALL leave the project store unchanged and notify the user that a name is required

#### Scenario: Replaces existing set with same name

- **WHEN** the project store already contains set `ui` and an interactive user saves a new selected context set named `ui`
- **THEN** the extension SHALL replace the old `ui` paths and estimates with the new selected paths and estimates

### Requirement: Saved context set loading

The picker SHALL let an interactive user load a saved context set into the current picker selection from any picker mode.

#### Scenario: Loads set into project-file mode selection

- **WHEN** an interactive user opens `/microscope` in project-file mode and loads saved set `ui` containing `src/index.ts` and `src/picker.ts`
- **THEN** the picker selected file count SHALL become 2 and pressing Enter SHALL insert both saved paths

#### Scenario: Loads set into git-changed mode selection

- **WHEN** an interactive user opens `/microscope` in git-changed mode and loads saved set `ui`
- **THEN** the picker SHALL load the saved paths into selection even if none of the saved paths are currently git-changed candidates

#### Scenario: Loads set into content grep mode selection

- **WHEN** an interactive user opens `/microscope` in content grep mode and loads saved set `ui`
- **THEN** the picker SHALL load the saved paths into selection even if the current grep query does not match those files

#### Scenario: Loading replaces current selection

- **WHEN** an interactive user has selected `src/old.ts` and then loads saved set `ui` containing `src/index.ts`
- **THEN** the current picker selection SHALL contain `src/index.ts` and SHALL NOT contain `src/old.ts`

#### Scenario: Loaded unreadable path remains insertable

- **WHEN** a saved set contains `src/deleted.ts` and that path is not readable on disk when the set is loaded
- **THEN** the picker SHALL include `src/deleted.ts` in the loaded selection and SHALL mark its estimate as unknown

#### Scenario: No saved sets to load

- **WHEN** an interactive user invokes load and the project store has no saved sets
- **THEN** the picker SHALL notify the user that no saved context sets exist and SHALL keep the current selection unchanged

### Requirement: Saved context set deletion

The picker SHALL let an interactive user delete a saved context set from the active project store without mutating the prompt editor.

#### Scenario: Deletes selected saved set

- **WHEN** the project store contains saved sets `ui` and `api` and an interactive user deletes `ui`
- **THEN** the project store SHALL keep `api`, remove `ui`, and update the saved set count

#### Scenario: Delete does not change prompt editor

- **WHEN** an interactive user deletes a saved context set while the prompt editor contains `inspect`
- **THEN** the prompt editor SHALL remain `inspect`

#### Scenario: No saved sets to delete

- **WHEN** an interactive user invokes delete and the project store has no saved sets
- **THEN** the picker SHALL notify the user that no saved context sets exist and SHALL keep the current selection unchanged

### Requirement: Saved context set counts and estimates

The picker SHALL show saved-set count, selected file count, and byte/token estimates for saved sets using the same approximate token semantics as context budget UI.

#### Scenario: Shows saved and selected counts

- **WHEN** the active project has 3 saved context sets and the current selection contains 2 deduped files
- **THEN** the picker SHALL show 3 saved sets and 2 selected files

#### Scenario: Shows saved set estimate in load list

- **WHEN** a saved set named `ui` contains readable files totaling 4096 bytes
- **THEN** the load list SHALL show `ui` with 2 files, 4 KB, and approximately 1024 tokens

#### Scenario: Shows unknown saved set sizes

- **WHEN** a saved set contains one readable file and one unreadable file
- **THEN** the saved-set summary SHALL include the readable bytes/tokens and SHALL show one unknown-size file

#### Scenario: Uses existing approximate token estimator

- **WHEN** a saved set contains readable files totaling 5 bytes
- **THEN** the saved-set approximate token estimate SHALL be 2 tokens

#### Scenario: Updates count after save and delete

- **WHEN** an interactive user saves a new set and then deletes it
- **THEN** the picker saved set count SHALL increase after save and decrease after delete

### Requirement: Saved set insertion preserves existing prompt behavior

Loading a saved context set SHALL only change picker selection; final prompt mutation SHALL continue to use existing deduped `@relative/path` insertion behavior.

#### Scenario: Loaded set inserts references with existing spacing

- **WHEN** the prompt editor contains `inspect`, a loaded saved set contains `src/index.ts` and `src/picker.ts`, and the user presses Enter
- **THEN** the prompt editor SHALL become `inspect @src/index.ts @src/picker.ts`

#### Scenario: Loaded set insertion dedupes paths

- **WHEN** a loaded saved set contains duplicate normalized paths for `src/index.ts` and the user presses Enter
- **THEN** the prompt editor SHALL contain exactly one `@src/index.ts` reference for that saved set

#### Scenario: Save action does not insert references

- **WHEN** an interactive user saves the current selection as a context set
- **THEN** the prompt editor SHALL remain unchanged until the user confirms insertion with Enter

#### Scenario: Load action does not insert references

- **WHEN** an interactive user loads a saved context set
- **THEN** the prompt editor SHALL remain unchanged until the user confirms insertion with Enter
