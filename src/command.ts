import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

import type { MicroscopeOptions } from "./config.ts";
import type { FileCandidate, FileSearchResult, FinderService } from "./finder.ts";
import type { GitChangedService } from "./git.ts";
import type { PickerMode, PickerUI } from "./picker.ts";

import { DEFAULT_MICROSCOPE_OPTIONS } from "./config.ts";
import { insertPathReferences, normalizePathReference } from "./editor.ts";
import { pickFiles as defaultPickFiles, pickerOptionsFromMicroscope } from "./picker.ts";
import { previewFile } from "./preview.ts";

export type PickFiles = (
  ui: PickerUI,
  loadCandidates: (mode: PickerMode, query: string) => Promise<FileSearchResult>,
  query: string,
  options: Parameters<typeof defaultPickFiles>[3],
) => Promise<FileCandidate[] | undefined>;

export interface MicroscopeDependencies {
  finder: FinderService;
  gitChanged: Pick<GitChangedService, "search">;
  options?: MicroscopeOptions;
  pickFiles?: PickFiles;
  basePath?: string;
}

export function createMicroscopeHandler(deps: MicroscopeDependencies) {
  const pickFiles = deps.pickFiles ?? defaultPickFiles;
  const options = deps.options ?? DEFAULT_MICROSCOPE_OPTIONS;

  return async (args: string, ctx: ExtensionCommandContext): Promise<void> => {
    if (!ctx.hasUI) {
      ctx.ui.notify("/microscope requires interactive UI", "error");
      return;
    }

    const query = args.trim();
    const loadCandidates = (mode: PickerMode, currentQuery: string) => {
      if (mode === "git-changed") return deps.gitChanged.search(currentQuery);
      if (mode === "content-grep") return deps.finder.grep(currentQuery);
      return deps.finder.search(currentQuery);
    };

    const selected = await pickFiles(ctx.ui as PickerUI, loadCandidates, query, {
      ...pickerOptionsFromMicroscope(options),
      preview: (candidate) => previewFile(deps.basePath ?? ctx.cwd, candidate, options.preview),
    });
    if (!selected) return;

    try {
      insertReferencesIntoEditor(
        ctx,
        selected.map((candidate) => candidate.relativePath),
      );
    } catch (error) {
      ctx.ui.notify(`Could not insert file references: ${getErrorMessage(error)}`, "error");
      return;
    }

    ctx.ui.notify(getInsertedMessage(selected), "info");
  };
}

export function insertReferencesIntoEditor(
  ctx: ExtensionCommandContext,
  relativePaths: string[],
): void {
  const currentText = ctx.ui.getEditorText();
  const nextText = insertPathReferences(currentText, dedupeRelativePaths(relativePaths));
  ctx.ui.setEditorText(nextText);
}

function getInsertedMessage(candidates: FileCandidate[]): string {
  const paths = dedupeRelativePaths(candidates.map((candidate) => candidate.relativePath));
  if (paths.length === 1) {
    return `Inserted @${normalizePathReference(paths[0]!)}`;
  }

  return `Inserted ${paths.length} file references`;
}

function dedupeRelativePaths(relativePaths: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const path of relativePaths) {
    const normalized = normalizePathReference(path);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
