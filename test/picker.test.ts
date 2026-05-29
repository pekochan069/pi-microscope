/// <reference types="bun-types/test-globals" />

import type { FileCandidate } from "../src/finder.ts";

import { pickFile, type PickerUI } from "../src/picker.ts";

const candidates: FileCandidate[] = [
  { relativePath: "README.md", fileName: "README.md", gitStatus: "clean", size: 1 },
  { relativePath: "src/index.ts", fileName: "index.ts", gitStatus: "modified", size: 2 },
];

function createUI(
  selection: string | undefined,
): PickerUI & { notifications: string[]; selections: string[][] } {
  const notifications: string[] = [];
  const selections: string[][] = [];
  return {
    notifications,
    selections,
    select: async (_title, options) => {
      selections.push(options);
      return selection;
    },
    notify: (message) => notifications.push(message),
  };
}

describe("pickFile", () => {
  test("returns selected candidate by exact relative path", async () => {
    const ui = createUI("src/index.ts");
    await expect(pickFile(ui, candidates, "src")).resolves.toEqual(candidates[1]);
    expect(ui.selections).toEqual([["README.md", "src/index.ts"]]);
  });

  test("returns undefined when selection is cancelled", async () => {
    const ui = createUI(undefined);
    await expect(pickFile(ui, candidates, "src")).resolves.toBeUndefined();
    expect(ui.notifications).toEqual([]);
  });

  test("notifies and returns undefined for empty candidates", async () => {
    const ui = createUI("README.md");
    await expect(pickFile(ui, [], "none")).resolves.toBeUndefined();
    expect(ui.notifications).toEqual(['No files matched "none"']);
    expect(ui.selections).toEqual([]);
  });

  test("refuses duplicate display paths", async () => {
    const ui = createUI("README.md");
    await expect(pickFile(ui, [candidates[0]!, candidates[0]!], "readme")).resolves.toBeUndefined();
    expect(ui.notifications).toEqual(["File picker received duplicate paths"]);
    expect(ui.selections).toEqual([]);
  });
});
