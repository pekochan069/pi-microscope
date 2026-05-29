import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

import type { FileCandidate } from "./finder.ts";

import { normalizePathReference } from "./editor.ts";

export type PreviewResult =
  | { status: "ok"; lines: string[]; truncated: boolean; startLine?: number }
  | { status: "unavailable"; message: string };

export interface PreviewOptions {
  enabled: boolean;
  maxBytes: number;
  maxLines: number;
}

export function previewFile(
  basePath: string,
  candidate: FileCandidate,
  options: PreviewOptions,
): PreviewResult {
  if (!options.enabled) return { status: "unavailable", message: "Preview disabled" };
  if (candidate.changeType === "deleted" || candidate.readable === false) {
    return { status: "unavailable", message: "Preview unavailable: file deleted" };
  }

  let relativePath: string;
  try {
    relativePath = normalizePathReference(candidate.relativePath);
  } catch (error) {
    return { status: "unavailable", message: getPreviewError(error) };
  }

  const root = resolve(basePath);
  const filePath = resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    return { status: "unavailable", message: "Preview unavailable: path escapes workspace" };
  }

  try {
    if (!existsSync(filePath))
      return { status: "unavailable", message: "Preview unavailable: file not found" };
    const stats = statSync(filePath);
    if (!stats.isFile())
      return { status: "unavailable", message: "Preview unavailable: not a file" };

    const bytes = readFileSync(filePath).subarray(0, options.maxBytes);
    if (bytes.includes(0))
      return { status: "unavailable", message: "Preview unavailable: binary file" };

    const text = bytes.toString("utf8");
    const allLines = text.split(/\r?\n/);
    const window = getPreviewWindow(allLines.length, options.maxLines, candidate.lineNumber);
    const lines = allLines.slice(window.startIndex, window.endIndex);
    const truncated =
      stats.size > options.maxBytes || window.startIndex > 0 || window.endIndex < allLines.length;
    return { status: "ok", lines, truncated, startLine: window.startLine };
  } catch (error) {
    return { status: "unavailable", message: `Preview unavailable: ${getPreviewError(error)}` };
  }
}

function getPreviewWindow(
  lineCount: number,
  maxLines: number,
  targetLine?: number,
): { startIndex: number; endIndex: number; startLine: number } {
  if (targetLine === undefined) {
    return { startIndex: 0, endIndex: Math.min(lineCount, maxLines), startLine: 1 };
  }

  const safeTarget = Math.min(lineCount, Math.max(1, targetLine));
  const halfWindow = Math.floor(maxLines / 2);
  const maxStart = Math.max(0, lineCount - maxLines);
  const startIndex = Math.min(maxStart, Math.max(0, safeTarget - 1 - halfWindow));
  return {
    startIndex,
    endIndex: Math.min(lineCount, startIndex + maxLines),
    startLine: startIndex + 1,
  };
}

function getPreviewError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
