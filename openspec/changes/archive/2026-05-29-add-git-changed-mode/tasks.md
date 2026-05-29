## 1. Mode and Data Model

- [x] 1.1 Add picker mode types for `project-files` and `git-changed` plus mode display labels.
- [x] 1.2 Extend `FileCandidate` metadata for changed-file status, rename original path, and preview readability without breaking existing project-file candidates.
- [x] 1.3 Refactor command-to-picker boundary so the picker can load candidates by mode and query during one overlay session.
- [x] 1.4 Preserve existing project-file search, cancel, single-select, multi-select, and insertion tests after the refactor.

## 2. Git-Changed Candidate Source

- [x] 2.1 Add a `GitChangedService` or equivalent boundary that runs `git -C <basePath> status --porcelain=v1 -z --untracked-files=all`.
- [x] 2.2 Parse modified, added, untracked, deleted, and renamed records into relative-path candidates.
- [x] 2.3 Insert renamed candidates using the new path while storing the old path as `originalPath` metadata.
- [x] 2.4 Filter git-changed candidates by the existing query using path-only matching.
- [x] 2.5 Return typed empty/error states for no changes, non-git workspaces, and git command failures.

## 3. Picker UI Behavior

- [x] 3.1 Add a mode toggle key and visible current-mode label in the picker header or footer.
- [x] 3.2 Reload candidates when toggling between project-file mode and git-changed mode.
- [x] 3.3 Reset highlight and selected paths when the active mode changes.
- [x] 3.4 Render changed-file status metadata for modified, added, deleted, and renamed candidates.
- [x] 3.5 Keep Enter behavior unchanged: selected candidates win; otherwise insert the highlighted candidate.

## 4. Preview Behavior

- [x] 4.1 Add a safe preview reader that rejects absolute/workspace-escaping paths and caps preview bytes/lines.
- [x] 4.2 Show bounded preview content for readable changed files.
- [x] 4.3 Show explicit preview-unavailable messages for deleted and unreadable changed files.
- [x] 4.4 Ensure preview errors do not close the picker or mutate editor text.

## 5. Tests and Validation

- [x] 5.1 Add porcelain parser tests for modified, added, untracked, deleted, and renamed files.
- [x] 5.2 Add picker tests for mode toggle, project-mode regression, selection reset, and changed status rendering.
- [x] 5.3 Add command-level tests for git-changed single insert, multi-select insert, renamed target insertion, cancel, empty, and error states.
- [x] 5.4 Add preview tests for readable, deleted, unreadable, large, and workspace-escape paths.
- [x] 5.5 Run `bun test`.
- [x] 5.6 Run `bun run check-types`.
- [x] 5.7 Run `bun run lint`.
- [x] 5.8 Run `bun run format:check`.
