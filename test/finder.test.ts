/// <reference types="bun-types/test-globals" />

import { FffFinderService, type NativeFinder, type NativeFinderAdapter } from "../src/finder.ts";

function createFakeFinder(overrides: Partial<NativeFinder> = {}): NativeFinder {
  return {
    waitForScan: async () => ({ ok: true, value: true }),
    fileSearch: () => ({
      ok: true,
      value: {
        items: [
          {
            relativePath: "src/index.ts",
            fileName: "index.ts",
            gitStatus: "modified",
            size: 123,
            modified: 0,
            accessFrecencyScore: 0,
            modificationFrecencyScore: 0,
            totalFrecencyScore: 0,
          },
        ],
        scores: [
          {
            total: 42,
            baseScore: 1,
            filenameBonus: 0,
            specialFilenameBonus: 0,
            frecencyBoost: 0,
            distancePenalty: 0,
            currentFilePenalty: 0,
            comboMatchBoost: 0,
            exactMatch: false,
            matchType: "fuzzy",
          },
        ],
        totalMatched: 1,
        totalFiles: 1,
      },
    }),
    destroy: () => {},
    ...overrides,
  };
}

function createAdapter(result: ReturnType<NativeFinderAdapter["create"]>): NativeFinderAdapter {
  return { create: () => result };
}

describe("FffFinderService", () => {
  test("creates lazily and maps search results", async () => {
    let createCount = 0;
    const finder = createFakeFinder();
    const service = new FffFinderService("/repo", {
      create: () => (createCount++, { ok: true, value: finder }),
    });

    const result = await service.search("src");
    expect(result).toEqual({
      status: "ok",
      candidates: [
        {
          relativePath: "src/index.ts",
          fileName: "index.ts",
          gitStatus: "modified",
          size: 123,
          score: 42,
        },
      ],
    });
    expect(createCount).toBe(1);

    await service.search("index");
    expect(createCount).toBe(1);
  });

  test("returns typed error when create fails", async () => {
    const service = new FffFinderService(
      "/repo",
      createAdapter({ ok: false, error: "missing binary" }),
    );
    await expect(service.search("src")).resolves.toEqual({
      status: "error",
      message: "missing binary",
    });
  });

  test("returns typed error when search fails", async () => {
    const finder = createFakeFinder({
      fileSearch: () => ({ ok: false, error: "search exploded" }),
    });
    const service = new FffFinderService("/repo", createAdapter({ ok: true, value: finder }));
    await expect(service.search("src")).resolves.toEqual({
      status: "error",
      message: "search exploded",
    });
  });

  test("continues when scan wait times out", async () => {
    const finder = createFakeFinder({ waitForScan: async () => ({ ok: false, error: "timeout" }) });
    const service = new FffFinderService("/repo", createAdapter({ ok: true, value: finder }));
    const result = await service.search("src");
    expect(result.status).toBe("ok");
  });

  test("destroys idempotently and rejects later searches", async () => {
    let destroyCount = 0;
    const finder = createFakeFinder({ destroy: () => destroyCount++ });
    const service = new FffFinderService("/repo", createAdapter({ ok: true, value: finder }));
    await service.search("src");

    service.destroy();
    service.destroy();

    expect(destroyCount).toBe(1);
    await expect(service.search("src")).resolves.toEqual({
      status: "error",
      message: "File finder has been destroyed",
    });
  });
});
