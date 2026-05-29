import { execFile } from "node:child_process";
import { statSync } from "node:fs";
import { basename, join } from "node:path";

import type { FileCandidate, FileSearchResult } from "./finder.ts";

export type GitChangeType = "modified" | "added" | "deleted" | "renamed";

export type GitStatusExecutor = (
  basePath: string,
) => Promise<{ ok: true; stdout: string } | { ok: false; error: string }>;

export class GitChangedService {
  constructor(
    private readonly basePath: string,
    private readonly executor: GitStatusExecutor = runGitStatus,
  ) {}

  async search(query: string): Promise<FileSearchResult> {
    const result = await this.executor(this.basePath);
    if (!result.ok) return { status: "error", message: result.error };

    const candidates = withChangedFileSizes(
      filterChangedCandidates(parseGitStatusPorcelain(result.stdout), query),
      this.basePath,
    );
    if (candidates.length === 0) {
      return {
        status: "empty",
        message: query ? `No changed files matched "${query}"` : "No changed files",
      };
    }

    return { status: "ok", candidates };
  }
}

export async function runGitStatus(
  basePath: string,
): Promise<{ ok: true; stdout: string } | { ok: false; error: string }> {
  return new Promise((resolveStatus) => {
    execFile(
      "git",
      ["-C", basePath, "status", "--porcelain=v1", "-z", "--untracked-files=all"],
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          resolveStatus({ ok: false, error: stderr.trim() || error.message });
          return;
        }

        resolveStatus({ ok: true, stdout });
      },
    );
  });
}

export function parseGitStatusPorcelain(output: string): FileCandidate[] {
  const records = output.split("\0").filter((record) => record.length > 0);
  const candidates: FileCandidate[] = [];

  for (let index = 0; index < records.length; index++) {
    const record = records[index]!;
    if (record.length < 4) continue;

    const x = record[0]!;
    const y = record[1]!;
    const status = `${x}${y}`;
    const path = record.slice(3);

    if (x === "R" || y === "R") {
      const originalPath = records[++index];
      candidates.push(createChangedCandidate(path, "renamed", status, originalPath));
      continue;
    }

    const changeType = getChangeType(x, y);
    if (!changeType) continue;
    candidates.push(createChangedCandidate(path, changeType, status));
  }

  return candidates;
}

export function filterChangedCandidates(
  candidates: FileCandidate[],
  query: string,
): FileCandidate[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) return candidates;

  return candidates.filter((candidate) => {
    const haystack = `${candidate.relativePath} ${candidate.originalPath ?? ""}`.toLowerCase();
    return haystack.includes(trimmed) || isSubsequence(trimmed, haystack);
  });
}

export function withChangedFileSizes(
  candidates: FileCandidate[],
  basePath: string,
): FileCandidate[] {
  return candidates.map((candidate) => {
    if (candidate.readable === false) return candidate;

    try {
      const stats = statSync(join(basePath, candidate.relativePath));
      if (!stats.isFile()) return { ...candidate, readable: false };
      return { ...candidate, size: stats.size, readable: true };
    } catch {
      return { ...candidate, readable: false };
    }
  });
}

function createChangedCandidate(
  relativePath: string,
  changeType: GitChangeType,
  gitStatus: string,
  originalPath?: string,
): FileCandidate {
  return {
    relativePath,
    fileName: basename(relativePath),
    gitStatus,
    size: 0,
    changeType,
    originalPath,
    readable: changeType !== "deleted",
  };
}

function getChangeType(x: string, y: string): GitChangeType | undefined {
  if (x === "D" || y === "D") return "deleted";
  if (x === "A" || y === "A" || x === "?") return "added";
  if (x === "M" || y === "M") return "modified";
  return undefined;
}

function isSubsequence(needle: string, haystack: string): boolean {
  let needleIndex = 0;
  for (const char of haystack) {
    if (char === needle[needleIndex]) needleIndex++;
    if (needleIndex === needle.length) return true;
  }
  return false;
}
