import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

import type { MicroscopeOptions } from "./config.ts";
import type { FileSearchResult, FinderService } from "./finder.ts";
import type { GitChangedService } from "./git.ts";
import type { PickerMode, PickerUI, PickFilesResult } from "./picker.ts";

import { DEFAULT_MICROSCOPE_OPTIONS } from "./config.ts";
import { deleteContextSet, loadContextSets, saveContextSet } from "./context-sets.ts";
import { insertPathReferences, normalizePathReference } from "./editor.ts";
import { pickFiles as defaultPickFiles, pickerOptionsFromMicroscope } from "./picker.ts";
import { previewFile } from "./preview.ts";

export type PickFiles = (
  ui: PickerUI,
  loadCandidates: (mode: PickerMode, query: string) => Promise<FileSearchResult>,
  query: string,
  options: Parameters<typeof defaultPickFiles>[3],
) => Promise<PickFilesResult | undefined>;

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
    const projectRoot = deps.basePath ?? ctx.cwd;
    const loadCandidates = (mode: PickerMode, currentQuery: string) => {
      if (mode === "git-changed") return deps.gitChanged.search(currentQuery);
      if (mode === "content-grep") return deps.finder.grep(currentQuery);
      return deps.finder.search(currentQuery);
    };

    const selected = await pickFiles(ctx.ui as PickerUI, loadCandidates, query, {
      ...pickerOptionsFromMicroscope(options),
      contextSets: {
        list: () => loadContextSets(projectRoot).sets,
        save: (name, paths) => saveContextSet(projectRoot, name, paths),
        delete: (name) => deleteContextSet(projectRoot, name),
      },
      preview: (candidate) => previewFile(projectRoot, candidate, options.preview),
    });
    if (!selected) return;

    const selectedPaths = selected.map((item) =>
      typeof item === "string" ? item : item.relativePath,
    );

    try {
      insertReferencesIntoEditor(ctx, selectedPaths);
    } catch (error) {
      ctx.ui.notify(`Could not insert file references: ${getErrorMessage(error)}`, "error");
      return;
    }

    ctx.ui.notify(getInsertedMessage(selectedPaths), "info");
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

function getInsertedMessage(relativePaths: string[]): string {
  const paths = dedupeRelativePaths(relativePaths);
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
