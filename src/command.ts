import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

import type { FileCandidate, FinderService } from "./finder.ts";

import { insertPathReference, normalizePathReference } from "./editor.ts";
import { pickFile as defaultPickFile } from "./picker.ts";

export type PickFile = (
  ui: ExtensionCommandContext["ui"],
  candidates: FileCandidate[],
  query: string,
) => Promise<FileCandidate | undefined>;

export interface MicroscopeDependencies {
  finder: FinderService;
  pickFile?: PickFile;
}

export function createMicroscopeHandler(deps: MicroscopeDependencies) {
  const pickFile = deps.pickFile ?? defaultPickFile;

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

    const selected = await pickFile(ctx.ui, result.candidates, query);
    if (!selected) return;

    insertReferenceIntoEditor(ctx, selected.relativePath);
    ctx.ui.notify(`Inserted @${normalizePathReference(selected.relativePath)}`, "info");
  };
}

export function insertReferenceIntoEditor(
  ctx: ExtensionCommandContext,
  relativePath: string,
): void {
  const currentText = ctx.ui.getEditorText();
  const nextText = insertPathReference(currentText, relativePath);
  ctx.ui.setEditorText(nextText);
}
