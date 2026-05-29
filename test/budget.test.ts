/// <reference types="bun-types/test-globals" />

import type { FileCandidate } from "../src/finder.ts";

import {
  byteCountToApproxTokens,
  createContextBudgetSummary,
  dedupeCandidatesByRelativePath,
  formatApproxTokens,
  formatBytes,
} from "../src/budget.ts";

const baseCandidate: FileCandidate = {
  relativePath: "src/index.ts",
  fileName: "index.ts",
  gitStatus: "clean",
  size: 8,
};

const secondCandidate: FileCandidate = {
  relativePath: "src/picker.ts",
  fileName: "picker.ts",
  gitStatus: "clean",
  size: 12,
};

describe("context budget helpers", () => {
  test("dedupes candidates by normalized relative path in first occurrence order", () => {
    expect(
      dedupeCandidatesByRelativePath([
        baseCandidate,
        secondCandidate,
        { ...baseCandidate, lineNumber: 20, rowKey: "src/index.ts:20:0:200:1" },
      ]).map((candidate) => candidate.relativePath),
    ).toEqual(["src/index.ts", "src/picker.ts"]);
  });

  test("estimates approximate tokens from bytes", () => {
    expect(byteCountToApproxTokens(0)).toBe(0);
    expect(byteCountToApproxTokens(1)).toBe(1);
    expect(byteCountToApproxTokens(8)).toBe(2);
    expect(byteCountToApproxTokens(9)).toBe(3);
  });

  test("formats bytes and approximate tokens", () => {
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatApproxTokens(24000)).toBe("24k tokens");
  });

  test("summarizes selected candidates, highlighted candidate, and over-budget state", () => {
    const summary = createContextBudgetSummary({
      selectedCandidates: [
        baseCandidate,
        { ...baseCandidate, lineNumber: 20, rowKey: "src/index.ts:20:0:200:1" },
        secondCandidate,
      ],
      highlightedCandidate: secondCandidate,
      maxTokens: 4,
    });

    expect(summary.selected.fileCount).toBe(2);
    expect(summary.selected.bytes).toBe(20);
    expect(summary.selected.approxTokens).toBe(5);
    expect(summary.highlighted).toEqual({ bytes: 12, approxTokens: 3 });
    expect(summary.isOverBudget).toBe(true);
  });

  test("handles unknown highlighted and selected sizes", () => {
    const deleted: FileCandidate = {
      relativePath: "src/deleted.ts",
      fileName: "deleted.ts",
      gitStatus: "D ",
      size: 0,
      changeType: "deleted",
      readable: false,
    };
    const summary = createContextBudgetSummary({
      selectedCandidates: [deleted],
      highlightedCandidate: deleted,
      maxTokens: 10,
    });

    expect(summary.selected.fileCount).toBe(1);
    expect(summary.selected.bytes).toBe(0);
    expect(summary.selected.approxTokens).toBe(0);
    expect(summary.selected.unknownFileCount).toBe(1);
    expect(summary.highlighted).toBeUndefined();
    expect(summary.isOverBudget).toBe(false);
  });
});
