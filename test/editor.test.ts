/// <reference types="bun-types/test-globals" />

import {
  insertPathReference,
  insertPathReferences,
  normalizePathReference,
} from "../src/editor.ts";

describe("insertPathReference", () => {
  test("inserts into empty editor", () => {
    expect(insertPathReference("", "src/index.ts")).toBe("@src/index.ts");
  });

  test("adds a separating space when editor has non-whitespace text", () => {
    expect(insertPathReference("hello", "src/index.ts")).toBe("hello @src/index.ts");
  });

  test("does not add extra space when editor already ends with whitespace", () => {
    expect(insertPathReference("hello ", "src/index.ts")).toBe("hello @src/index.ts");
    expect(insertPathReference("hello\n", "src/index.ts")).toBe("hello\n@src/index.ts");
  });

  test("allows repeated inserts", () => {
    const first = insertPathReference("", "README.md");
    expect(insertPathReference(first, "src/index.ts")).toBe("@README.md @src/index.ts");
  });

  test("preserves whitespace inside paths", () => {
    expect(insertPathReference("check", "docs/my file.md")).toBe("check @docs/my file.md");
  });
});

describe("insertPathReferences", () => {
  test("inserts multiple paths into empty editor in order", () => {
    expect(insertPathReferences("", ["src/index.ts", "src/finder.ts"])).toBe(
      "@src/index.ts @src/finder.ts",
    );
  });

  test("adds one separating space before multiple paths for existing text", () => {
    expect(insertPathReferences("inspect", ["src/index.ts", "src/finder.ts"])).toBe(
      "inspect @src/index.ts @src/finder.ts",
    );
  });

  test("does not add extra space before multiple paths after trailing whitespace", () => {
    expect(insertPathReferences("inspect ", ["src/index.ts", "src/finder.ts"])).toBe(
      "inspect @src/index.ts @src/finder.ts",
    );
  });

  test("normalizes all paths before insertion", () => {
    expect(insertPathReferences("see", ["./src\\index.ts", "test//picker.test.ts"])).toBe(
      "see @src/index.ts @test/picker.test.ts",
    );
  });

  test("rejects empty batch", () => {
    expect(() => insertPathReferences("", [])).toThrow("At least one path reference is required");
  });
});

describe("normalizePathReference", () => {
  test("normalizes path separators and leading current-directory segments", () => {
    expect(normalizePathReference("./src\\picker\\component.ts")).toBe("src/picker/component.ts");
  });

  test("rejects absolute and workspace-escaping paths", () => {
    expect(() => normalizePathReference("")).toThrow("Path reference cannot be empty");
    expect(() => normalizePathReference("/tmp/file.ts")).toThrow("Path reference must be relative");
    expect(() => normalizePathReference("C:\\tmp\\file.ts")).toThrow(
      "Path reference must be relative",
    );
    expect(() => normalizePathReference("../outside.ts")).toThrow("Path reference cannot escape");
    expect(() => normalizePathReference("src/../outside.ts")).toThrow(
      "Path reference cannot escape",
    );
  });
});
