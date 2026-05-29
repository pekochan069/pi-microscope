## 1. Configuration

- [x] 1.1 Add `MicroscopeContextBudgetOptions` with `maxTokens` to config types and defaults.
- [x] 1.2 Parse `piMicroscope.contextBudget.maxTokens` from global/project settings with validation warnings.
- [x] 1.3 Add config tests for default budget, valid override, invalid override, and project-over-global merge behavior.

## 2. Budget Estimation Helpers

- [x] 2.1 Add pure helpers to normalize and dedupe candidate paths for budget/insertion semantics.
- [x] 2.2 Add deterministic byte-to-token estimator and formatting helpers for bytes/tokens.
- [x] 2.3 Add pure budget summary helper for selected candidates, highlighted candidate, and over-budget state.
- [x] 2.4 Add unit tests for deduped count, grep duplicate rows, unknown sizes, over-budget warnings, and first-occurrence ordering.

## 3. Picker UI

- [x] 3.1 Pass context budget options through `PickFilesOptions` and `pickerOptionsFromMicroscope`.
- [x] 3.2 Render selected file count, selected bytes/tokens, active budget, and highlighted file estimate in the picker.
- [x] 3.3 Render visible over-budget warning when selected approximate tokens exceed active budget.
- [x] 3.4 Ensure budget summary updates when selecting/unselecting candidates and resets when modes or query reloads clear selection.
- [x] 3.5 Add picker rendering tests for project-file, git-changed, and content grep modes.

## 4. Insertion Semantics

- [x] 4.1 Ensure confirmed candidates are deduped by normalized relative path before insertion.
- [x] 4.2 Preserve existing append-only editor spacing behavior for single and multi-file insertion.
- [x] 4.3 Add command/editor tests for duplicate selections across project-file, git-changed, and content grep cases.

## 5. Validation

- [x] 5.1 Run `bun test`.
- [x] 5.2 Run `bun run check-types`.
- [x] 5.3 Run `bun run lint`.
- [x] 5.4 Run `bun run format:check`.
- [x] 5.5 Record files changed, budget UI behavior added, checks run, and known follow-ups in the implementation summary.
