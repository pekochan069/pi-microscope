/// <reference types="bun-types/test-globals" />

import type { FileCandidate, FileSearchResult } from "../src/finder.ts";

import { DEFAULT_MICROSCOPE_OPTIONS } from "../src/config.ts";
import {
  MultiSelectPickerComponent,
  confirmPickerSelection,
  createPickerState,
  getSelectedCount,
  moveHighlight,
  pickFiles,
  renderCandidateRows,
  switchPickerMode,
  toggleHighlightedCandidate,
  type PickerUI,
} from "../src/picker.ts";

const candidates: FileCandidate[] = [
  { relativePath: "README.md", fileName: "README.md", gitStatus: "clean", size: 1 },
  { relativePath: "src/index.ts", fileName: "index.ts", gitStatus: "modified", size: 2 },
  { relativePath: "src/finder.ts", fileName: "finder.ts", gitStatus: "clean", size: 3 },
];

const changedCandidates: FileCandidate[] = [
  {
    relativePath: "src/index.ts",
    fileName: "index.ts",
    gitStatus: " M",
    size: 0,
    changeType: "modified",
  },
  {
    relativePath: "src/new.ts",
    fileName: "new.ts",
    gitStatus: "R ",
    size: 0,
    changeType: "renamed",
    originalPath: "src/old.ts",
  },
];

function createUI(selection: FileCandidate[] | undefined): PickerUI & { notifications: string[] } {
  const notifications: string[] = [];
  return {
    notifications,
    custom: async <T>() => selection as T,
    notify: (message) => notifications.push(message),
  };
}

function ok(items = candidates): FileSearchResult {
  return { status: "ok", candidates: items };
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

  test("switching mode resets selection and highlight", () => {
    const selectedState = toggleHighlightedCandidate(createPickerState(), candidates);
    const next = switchPickerMode(selectedState, "git-changed");

    expect(next.mode).toBe("git-changed");
    expect(next.highlightedIndex).toBe(0);
    expect(next.selectedPaths.size).toBe(0);
  });

  test("rendered rows preserve exact paths with selected markers", () => {
    const selectedState = toggleHighlightedCandidate(createPickerState(), candidates);

    expect(renderCandidateRows(candidates, selectedState, 80)).toEqual([
      "> [x] README.md",
      "  [ ] src/index.ts",
      "  [ ] src/finder.ts",
    ]);
  });

  test("rendered changed rows include status and rename metadata", () => {
    expect(renderCandidateRows(changedCandidates, createPickerState("git-changed"), 80)).toEqual([
      "> [ ] M src/index.ts",
      "  [ ] R src/new.ts ← src/old.ts",
    ]);
  });
});

describe("pickFiles", () => {
  test("returns selected candidates from custom picker", async () => {
    const ui = createUI([candidates[1] as FileCandidate, candidates[2] as FileCandidate]);

    await expect(
      pickFiles(ui, async () => ok(), "src", {
        initialMode: "project-files",
        keys: DEFAULT_MICROSCOPE_OPTIONS.keys,
      }),
    ).resolves.toEqual([candidates[1]!, candidates[2]!]);
  });

  test("returns undefined when selection is cancelled", async () => {
    const ui = createUI(undefined);

    await expect(
      pickFiles(ui, async () => ok(), "src", {
        initialMode: "project-files",
        keys: DEFAULT_MICROSCOPE_OPTIONS.keys,
      }),
    ).resolves.toBeUndefined();
    expect(ui.notifications).toEqual([]);
  });

  test("notifies and returns undefined for empty initial candidates", async () => {
    const ui = createUI([candidates[0] as FileCandidate]);

    await expect(
      pickFiles(ui, async () => ({ status: "empty", message: 'No files matched "none"' }), "none", {
        initialMode: "project-files",
        keys: DEFAULT_MICROSCOPE_OPTIONS.keys,
      }),
    ).resolves.toBeUndefined();
    expect(ui.notifications).toEqual(['No files matched "none"']);
  });

  test("refuses duplicate display paths", async () => {
    const ui = createUI([candidates[0] as FileCandidate]);

    await expect(
      pickFiles(ui, async () => ok([candidates[0]!, candidates[0]!]), "readme", {
        initialMode: "project-files",
        keys: DEFAULT_MICROSCOPE_OPTIONS.keys,
      }),
    ).resolves.toBeUndefined();
    expect(ui.notifications).toEqual(["File picker received duplicate paths"]);
  });

  test("notifies when custom UI is unavailable", async () => {
    const notifications: string[] = [];
    const ui: PickerUI = { notify: (message) => notifications.push(message) };

    await expect(
      pickFiles(ui, async () => ok(), "src", {
        initialMode: "project-files",
        keys: DEFAULT_MICROSCOPE_OPTIONS.keys,
      }),
    ).resolves.toBeUndefined();
    expect(notifications).toEqual(["Multi-select file picker requires custom UI"]);
  });
});

describe("MultiSelectPickerComponent", () => {
  test("ctrl+g loads git-changed mode and ctrl+f loads project mode", async () => {
    const modes: string[] = [];
    const component = new MultiSelectPickerComponent(
      "src",
      async (mode) => {
        modes.push(mode);
        return mode === "git-changed" ? ok(changedCandidates) : ok(candidates);
      },
      candidates,
      { initialMode: "project-files", keys: DEFAULT_MICROSCOPE_OPTIONS.keys },
      () => {},
    );

    component.handleInput("\u0007");
    await Promise.resolve();
    expect(component.render(80)[0]).toContain("Git changed");
    expect(component.render(80).join("\n")).toContain("M src/index.ts");

    component.handleInput("\u0006");
    await Promise.resolve();
    expect(component.render(80)[0]).toContain("Project files");
    expect(modes).toEqual(["git-changed", "project-files"]);
  });
});
