/// <reference types="bun-types/test-globals" />

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GitChangedService, filterChangedCandidates, parseGitStatusPorcelain } from "../src/git.ts";

describe("parseGitStatusPorcelain", () => {
  test("parses modified added untracked deleted and renamed records", () => {
    const output = [
      " M src/modified.ts",
      "A  src/added.ts",
      "?? src/untracked.ts",
      " D src/deleted.ts",
      "R  src/new.ts",
      "src/old.ts",
      "",
    ].join("\0");

    expect(parseGitStatusPorcelain(output)).toEqual([
      expect.objectContaining({ relativePath: "src/modified.ts", changeType: "modified" }),
      expect.objectContaining({ relativePath: "src/added.ts", changeType: "added" }),
      expect.objectContaining({ relativePath: "src/untracked.ts", changeType: "added" }),
      expect.objectContaining({
        relativePath: "src/deleted.ts",
        changeType: "deleted",
        readable: false,
      }),
      expect.objectContaining({
        relativePath: "src/new.ts",
        changeType: "renamed",
        originalPath: "src/old.ts",
      }),
    ]);
  });
});

describe("GitChangedService", () => {
  test("populates size metadata for readable changed files", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-microscope-git-"));
    try {
      writeFileSync(join(dir, "changed.ts"), "12345678");
      const service = new GitChangedService(dir, async () => ({
        ok: true,
        stdout: " M changed.ts\0 D deleted.ts\0",
      }));

      const result = await service.search("");

      expect(result).toEqual({
        status: "ok",
        candidates: [
          expect.objectContaining({
            relativePath: "changed.ts",
            size: 8,
            readable: true,
          }),
          expect.objectContaining({
            relativePath: "deleted.ts",
            size: 0,
            readable: false,
          }),
        ],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("filterChangedCandidates", () => {
  const candidates = parseGitStatusPorcelain(
    " M src/index.ts\0R  src/new-name.ts\0src/old-name.ts\0",
  );

  test("keeps all candidates for empty query", () => {
    expect(filterChangedCandidates(candidates, "")).toHaveLength(2);
  });

  test("matches current and original paths", () => {
    expect(
      filterChangedCandidates(candidates, "index").map((candidate) => candidate.relativePath),
    ).toEqual(["src/index.ts"]);
    expect(
      filterChangedCandidates(candidates, "old-name").map((candidate) => candidate.relativePath),
    ).toEqual(["src/new-name.ts"]);
  });
});
