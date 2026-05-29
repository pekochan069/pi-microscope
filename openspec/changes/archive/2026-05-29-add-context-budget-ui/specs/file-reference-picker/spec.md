## ADDED Requirements

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
