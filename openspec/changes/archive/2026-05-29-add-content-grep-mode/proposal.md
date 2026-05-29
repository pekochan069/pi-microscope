## Why

`/microscope` already supports project-file lookup, multi-select insertion, and git-changed mode. The next high-value context assembly loop is searching inside file contents so users can find the right file by a remembered symbol, phrase, error, or test name and insert the file reference without leaving Pi.

## What Changes

- Add a third picker mode: content grep, alongside project files and git-changed files.
- Make the mode toggle cycle through project files → git-changed → content grep → project files while preserving existing project and git behavior.
- In content grep mode, search repository file contents using the current query.
- Show grep results as file path plus matching line snippet.
- Preview the selected result by opening the matched file around the matched line.
- Support multi-select in grep mode and insert deduped `@relative/path` references.
- Preserve Enter behavior: insert selected references when any results are selected, otherwise insert the currently highlighted result.
- Do not add prompt-aware ranking, token budgeting, saved presets, or new insertion formats in this change.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `file-reference-picker`: Adds content grep as a picker mode and defines grep result display, match-line preview, and deduped file-reference insertion behavior.

## Impact

- Picker mode state, labels, key handling, result rendering, and selection behavior.
- Finder wrapper/provider behavior for content grep queries.
- Preview logic to support line-centered previews for grep matches.
- Editor insertion behavior where multiple grep hits may map to the same file path and must dedupe inserted references.
- Automated tests covering mode cycling, grep search/display, preview centering, deduped insertion, and unchanged project/git behavior.
