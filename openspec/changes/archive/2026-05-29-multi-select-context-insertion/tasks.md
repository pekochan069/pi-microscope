## 1. Batch Editor Insertion

- [x] 1.1 Add `insertPathReferences(currentText, relativePaths)` in `src/editor.ts` using existing path normalization and append-only spacing rules
- [x] 1.2 Keep `insertPathReference(currentText, relativePath)` as a one-path wrapper so existing single-file behavior remains unchanged
- [x] 1.3 Add editor tests for empty prompt, existing prompt, trailing whitespace, repeated references, invalid paths, and multiple-path insertion order

## 2. Picker Selection Model

- [x] 2.1 Add pure picker state helpers for highlighted index, selected path set, toggle select/unselect, selected count, and confirm result
- [x] 2.2 Add picker tests for selecting multiple files, unselecting a file, showing selected count data, duplicate path refusal, cancel behavior, and Enter with no selected files returning the highlighted/current file
- [x] 2.3 Preserve exact `relativePath` identity for candidate mapping; do not parse rich display labels back into candidates

## 3. Picker UI Behavior

- [x] 3.1 Replace or wrap the single-select `ctx.ui.select()` flow with a selected-count-capable picker UI using existing pi UI/TUI APIs
- [x] 3.2 Render selected/unselected markers for visible rows and a visible `Selected: N` count
- [x] 3.3 Support Up/Down movement, Space select/unselect, Enter confirm selected/current files, and Escape cancel
- [x] 3.4 Keep this change scoped to file selection and insertion only; do not add git/content/prompt-aware modes, previews, token estimates, or presets

## 4. Command Integration

- [x] 4.1 Change command dependency type from single `pickFile` to multi-result `pickFiles` returning selected `FileCandidate[] | undefined`
- [x] 4.2 Update `/microscope` handler to insert all returned paths with one `setEditorText()` call and no partial editor mutation on insertion errors
- [x] 4.3 Preserve no-UI, finder-error, no-result, duplicate-path, and cancel branches without editor mutation
- [x] 4.4 Update notifications so single insert can name the path and multi insert reports inserted file-reference count

## 5. Verification

- [x] 5.1 Run `bun test`
- [x] 5.2 Run `bun run check-types`
- [x] 5.3 Run `bun run lint`
- [x] 5.4 Run `bun run format:check`
- [x] 5.5 Record files changed, behavior added, checks run, and known follow-ups after implementation
