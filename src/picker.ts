import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";

import type { FileCandidate } from "./finder.ts";

export type PickerUI = Pick<ExtensionUIContext, "select" | "notify">;

export async function pickFile(
  ui: PickerUI,
  candidates: FileCandidate[],
  query = "",
): Promise<FileCandidate | undefined> {
  if (candidates.length === 0) {
    ui.notify(`No files matched "${query}"`, "warning");
    return undefined;
  }

  const options = candidates.map((candidate) => candidate.relativePath);
  if (new Set(options).size !== options.length) {
    ui.notify("File picker received duplicate paths", "error");
    return undefined;
  }

  const title = query ? `Select file for "${query}"` : "Select file";
  const selectedPath = await ui.select(title, options);
  if (!selectedPath) return undefined;

  return candidates.find((candidate) => candidate.relativePath === selectedPath);
}
