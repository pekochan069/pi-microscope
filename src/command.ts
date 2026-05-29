import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

import type { FileCandidate, FinderService } from "./finder.ts";
import type { PickerUI } from "./picker.ts";

import { insertPathReferences, normalizePathReference } from "./editor.ts";
import { pickFiles as defaultPickFiles } from "./picker.ts";

export type PickFiles = (
  ui: PickerUI,
  candidates: FileCandidate[],
  query: string,
) => Promise<FileCandidate[] | undefined>;

export interface MicroscopeDependencies {
  finder: FinderService;
  pickFiles?: PickFiles;
}

export function createMicroscopeHandler(deps: MicroscopeDependencies) {
  const pickFiles = deps.pickFiles ?? defaultPickFiles;

  return async (args: string, ctx: ExtensionCommandContext): Promise<void> => {
    if (!ctx.hasUI) {
      ctx.ui.notify("/microscope requires interactive UI", "error");
      return;
    }

    const query = args.trim();
    const result = await deps.finder.search(query);
    if (result.status === "error") {
      ctx.ui.notify(`Could not search files: ${result.message}`, "error");
      return;
    }

    if (result.status === "empty") {
      ctx.ui.notify(result.message, "warning");
      return;
    }

    const selected = await pickFiles(ctx.ui as PickerUI, result.candidates, query);
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
  const nextText = insertPathReferences(currentText, relativePaths);
  ctx.ui.setEditorText(nextText);
}

function getInsertedMessage(candidates: FileCandidate[]): string {
  if (candidates.length === 1) {
    return `Inserted @${normalizePathReference(candidates[0]!.relativePath)}`;
  }

  return `Inserted ${candidates.length} file references`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
