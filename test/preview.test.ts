/// <reference types="bun-types/test-globals" />

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FileCandidate } from "../src/finder.ts";

import { previewFile } from "../src/preview.ts";

const baseCandidate: FileCandidate = {
  relativePath: "src/index.ts",
  fileName: "index.ts",
  gitStatus: " M",
  size: 0,
  changeType: "modified",
};

function tempRepo() {
  const dir = mkdtempSync(join(tmpdir(), "pi-microscope-preview-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("previewFile", () => {
  test("returns bounded preview for readable file", () => {
    const repo = tempRepo();
    try {
      writeFileSync(join(repo.dir, "src", "index.ts"), "one\ntwo\nthree");
      expect(
        previewFile(repo.dir, baseCandidate, { enabled: true, maxBytes: 100, maxLines: 2 }),
      ).toEqual({
        status: "ok",
        lines: ["one", "two"],
        truncated: true,
        startLine: 1,
      });
    } finally {
      repo.cleanup();
    }
  });

  test("centers preview around match line", () => {
    const repo = tempRepo();
    try {
      writeFileSync(join(repo.dir, "src", "index.ts"), "one\ntwo\nthree\nfour\nfive");
      expect(
        previewFile(
          repo.dir,
          { ...baseCandidate, lineNumber: 4 },
          {
            enabled: true,
            maxBytes: 100,
            maxLines: 3,
          },
        ),
      ).toEqual({
        status: "ok",
        lines: ["three", "four", "five"],
        truncated: true,
        startLine: 3,
      });
    } finally {
      repo.cleanup();
    }
  });

  test("reports binary preview unavailable", () => {
    const repo = tempRepo();
    try {
      writeFileSync(join(repo.dir, "src", "index.ts"), Buffer.from([1, 0, 2]));
      expect(
        previewFile(repo.dir, baseCandidate, { enabled: true, maxBytes: 100, maxLines: 10 }),
      ).toEqual({ status: "unavailable", message: "Preview unavailable: binary file" });
    } finally {
      repo.cleanup();
    }
  });

  test("reports deleted preview unavailable", () => {
    expect(
      previewFile(
        "/repo",
        { ...baseCandidate, changeType: "deleted", readable: false },
        {
          enabled: true,
          maxBytes: 100,
          maxLines: 10,
        },
      ),
    ).toEqual({ status: "unavailable", message: "Preview unavailable: file deleted" });
  });

  test("reports workspace escape unavailable", () => {
    expect(
      previewFile(
        "/repo",
        { ...baseCandidate, relativePath: "../secret" },
        {
          enabled: true,
          maxBytes: 100,
          maxLines: 10,
        },
      ).status,
    ).toBe("unavailable");
  });

  test("reports missing file unavailable", () => {
    const repo = tempRepo();
    try {
      expect(
        previewFile(repo.dir, baseCandidate, { enabled: true, maxBytes: 100, maxLines: 10 }),
      ).toEqual({
        status: "unavailable",
        message: "Preview unavailable: file not found",
      });
    } finally {
      repo.cleanup();
    }
  });
});
