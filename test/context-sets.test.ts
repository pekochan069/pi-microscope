/// <reference types="bun-types/test-globals" />

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  deleteContextSet,
  estimateSavedPaths,
  getContextSetsPath,
  loadContextSets,
  saveContextSet,
} from "../src/context-sets.ts";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "pi-microscope-context-sets-"));
}

describe("context set storage", () => {
  test("missing project store starts empty", () => {
    const project = tempProject();

    expect(loadContextSets(project)).toEqual({ version: 1, sets: [] });
    expect(getContextSetsPath(project)).toBe(
      join(project, ".pi", "microscope", "context-sets.json"),
    );
  });

  test("saves to project-local storage with normalized deduped paths", () => {
    const project = tempProject();
    writeFileSync(join(project, "a.ts"), "12345");
    mkdirSync(join(project, "src"));
    writeFileSync(join(project, "src", "b.ts"), "1234");

    const saved = saveContextSet(project, "ui", ["./a.ts", "a.ts", "src/b.ts"]);
    const store = loadContextSets(project);

    expect(saved.paths).toEqual(["a.ts", "src/b.ts"]);
    expect(saved.bytes).toBe(9);
    expect(saved.approxTokens).toBe(3);
    expect(saved.unknownFileCount).toBe(0);
    expect(store.sets.map((set) => set.name)).toEqual(["ui"]);
    expect(JSON.parse(readFileSync(getContextSetsPath(project), "utf8"))).toMatchObject({
      version: 1,
      sets: [{ name: "ui", paths: ["a.ts", "src/b.ts"] }],
    });
  });

  test("project stores are independent", () => {
    const first = tempProject();
    const second = tempProject();

    saveContextSet(first, "api", ["src/index.ts"]);

    expect(loadContextSets(first).sets.map((set) => set.name)).toEqual(["api"]);
    expect(loadContextSets(second).sets).toEqual([]);
  });

  test("replaces existing set with same name", () => {
    const project = tempProject();

    saveContextSet(project, "ui", ["a.ts"]);
    saveContextSet(project, "ui", ["b.ts"]);

    expect(loadContextSets(project).sets).toHaveLength(1);
    expect(loadContextSets(project).sets[0]?.paths).toEqual(["b.ts"]);
  });

  test("deletes one set and keeps others", () => {
    const project = tempProject();
    saveContextSet(project, "ui", ["a.ts"]);
    saveContextSet(project, "api", ["b.ts"]);

    expect(deleteContextSet(project, "ui")).toBe(true);
    expect(loadContextSets(project).sets.map((set) => set.name)).toEqual(["api"]);
    expect(deleteContextSet(project, "missing")).toBe(false);
  });

  test("invalid names and paths are rejected", () => {
    const project = tempProject();

    expect(() => saveContextSet(project, " ", ["a.ts"])).toThrow("Context set name is required");
    expect(() => saveContextSet(project, "ui", [])).toThrow("At least one path is required");
    expect(() => saveContextSet(project, "ui", ["../outside.ts"])).toThrow(
      "Path reference cannot escape the workspace",
    );
    expect(loadContextSets(project).sets).toEqual([]);
  });

  test("corrupt or invalid stores are treated as empty", () => {
    const project = tempProject();
    mkdirSync(join(project, ".pi", "microscope"), { recursive: true });
    writeFileSync(getContextSetsPath(project), "not json");

    expect(loadContextSets(project)).toEqual({ version: 1, sets: [] });
  });

  test("estimate saved paths counts unreadable files as unknown", () => {
    const project = tempProject();
    writeFileSync(join(project, "a.ts"), "12345");

    expect(estimateSavedPaths(project, ["a.ts", "missing.ts"])).toEqual({
      bytes: 5,
      approxTokens: 2,
      unknownFileCount: 1,
    });
  });
});
