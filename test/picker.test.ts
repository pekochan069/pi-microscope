/// <reference types="bun-types/test-globals" />

import type { FileCandidate } from "../src/finder.ts";

import {
  confirmPickerSelection,
  createPickerState,
  getSelectedCount,
  moveHighlight,
  pickFiles,
  renderCandidateRows,
  toggleHighlightedCandidate,
  type PickerUI,
} from "../src/picker.ts";

const candidates: FileCandidate[] = [
  { relativePath: "README.md", fileName: "README.md", gitStatus: "clean", size: 1 },
  { relativePath: "src/index.ts", fileName: "index.ts", gitStatus: "modified", size: 2 },
  { relativePath: "src/finder.ts", fileName: "finder.ts", gitStatus: "clean", size: 3 },
];

function createUI(selection: FileCandidate[] | undefined): PickerUI & { notifications: string[] } {
  const notifications: string[] = [];
  return {
    notifications,
    custom: async <T>() => selection as T,
    notify: (message) => notifications.push(message),
  };
}

describe("picker state", () => {
  test("confirm returns highlighted candidate when nothing is selected", () => {
    const state = moveHighlight(createPickerState(), candidates, 1);

    expect(confirmPickerSelection(state, candidates)).toEqual([candidates[1]!]);
  });

  test("toggles selected candidates and confirms them in candidate order", () => {
    let state = createPickerState();
    state = moveHighlight(state, candidates, 1);
    state = toggleHighlightedCandidate(state, candidates);
    state = moveHighlight(state, candidates, 1);
    state = toggleHighlightedCandidate(state, candidates);

    expect(getSelectedCount(state)).toBe(2);
    expect(confirmPickerSelection(state, candidates)).toEqual([candidates[1]!, candidates[2]!]);
  });

  test("unselects a selected candidate", () => {
    let state = createPickerState();
    state = toggleHighlightedCandidate(state, candidates);
    state = toggleHighlightedCandidate(state, candidates);

    expect(getSelectedCount(state)).toBe(0);
    expect(confirmPickerSelection(state, candidates)).toEqual([candidates[0]!]);
  });

  test("movement stays within candidate bounds", () => {
    let state = createPickerState();
    state = moveHighlight(state, candidates, -1);
    expect(state.highlightedIndex).toBe(0);

    state = moveHighlight(state, candidates, 99);
    expect(state.highlightedIndex).toBe(2);
  });

  test("rendered rows preserve exact paths with selected markers", () => {
    const selectedState = toggleHighlightedCandidate(createPickerState(), candidates);

    expect(renderCandidateRows(candidates, selectedState, 80)).toEqual([
      "> [x] README.md",
      "  [ ] src/index.ts",
      "  [ ] src/finder.ts",
    ]);
  });
});

describe("pickFiles", () => {
  test("returns selected candidates from custom picker", async () => {
    const ui = createUI([candidates[1] as FileCandidate, candidates[2] as FileCandidate]);

    await expect(pickFiles(ui, candidates, "src")).resolves.toEqual([
      candidates[1]!,
      candidates[2]!,
    ]);
  });

  test("returns undefined when selection is cancelled", async () => {
    const ui = createUI(undefined);

    await expect(pickFiles(ui, candidates, "src")).resolves.toBeUndefined();
    expect(ui.notifications).toEqual([]);
  });

  test("notifies and returns undefined for empty candidates", async () => {
    const ui = createUI([candidates[0] as FileCandidate]);

    await expect(pickFiles(ui, [], "none")).resolves.toBeUndefined();
    expect(ui.notifications).toEqual(['No files matched "none"']);
  });

  test("refuses duplicate display paths", async () => {
    const ui = createUI([candidates[0] as FileCandidate]);

    await expect(
      pickFiles(ui, [candidates[0]!, candidates[0]!], "readme"),
    ).resolves.toBeUndefined();
    expect(ui.notifications).toEqual(["File picker received duplicate paths"]);
  });

  test("notifies when custom UI is unavailable", async () => {
    const notifications: string[] = [];
    const ui: PickerUI = { notify: (message) => notifications.push(message) };

    await expect(pickFiles(ui, candidates, "src")).resolves.toBeUndefined();
    expect(notifications).toEqual(["Multi-select file picker requires custom UI"]);
  });
});
