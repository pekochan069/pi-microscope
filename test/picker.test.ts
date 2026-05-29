/// <reference types="bun-types/test-globals" />

import type { FileCandidate, FileSearchResult } from "../src/finder.ts";

import { DEFAULT_MICROSCOPE_OPTIONS } from "../src/config.ts";
import {
  MultiSelectPickerComponent,
  confirmPickerSelection,
  createPickerState,
  getNextPickerMode,
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

const grepCandidates: FileCandidate[] = [
  {
    relativePath: "src/index.ts",
    fileName: "index.ts",
    gitStatus: "clean",
    size: 2,
    lineNumber: 10,
    lineSnippet: "export function run() {}",
    rowKey: "src/index.ts:10:0:100:0",
  },
  {
    relativePath: "src/index.ts",
    fileName: "index.ts",
    gitStatus: "clean",
    size: 2,
    lineNumber: 20,
    lineSnippet: "run();",
    rowKey: "src/index.ts:20:0:200:1",
  },
  {
    relativePath: "src/picker.ts",
    fileName: "picker.ts",
    gitStatus: "clean",
    size: 3,
    lineNumber: 30,
    lineSnippet: "renderCandidateRows(candidates)",
    rowKey: "src/picker.ts:30:0:300:2",
  },
];

const changedCandidates: FileCandidate[] = [
  {
    relativePath: "src/index.ts",
    fileName: "index.ts",
    gitStatus: " M",
    size: 8,
    changeType: "modified",
  },
  {
    relativePath: "src/new.ts",
    fileName: "new.ts",
    gitStatus: "R ",
    size: 16,
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

  test("mode order cycles through project, git, grep", () => {
    expect(getNextPickerMode("project-files")).toBe("git-changed");
    expect(getNextPickerMode("git-changed")).toBe("content-grep");
    expect(getNextPickerMode("content-grep")).toBe("project-files");
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

  test("rendered grep rows include line numbers and snippets", () => {
    expect(
      renderCandidateRows(grepCandidates.slice(0, 2), createPickerState("content-grep"), 80),
    ).toEqual(["> [ ] src/index.ts:10 export function run() {}", "  [ ] src/index.ts:20 run();"]);
  });

  test("duplicate-path grep rows can be selected independently", () => {
    let state = createPickerState("content-grep");
    state = toggleHighlightedCandidate(state, grepCandidates);
    state = moveHighlight(state, grepCandidates, 1);
    state = toggleHighlightedCandidate(state, grepCandidates);

    expect(getSelectedCount(state)).toBe(2);
    expect(confirmPickerSelection(state, grepCandidates)).toEqual([
      grepCandidates[0]!,
      grepCandidates[1]!,
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

  test("refuses duplicate result rows", async () => {
    const ui = createUI([candidates[0] as FileCandidate]);

    await expect(
      pickFiles(ui, async () => ok([candidates[0]!, candidates[0]!]), "readme", {
        initialMode: "project-files",
        keys: DEFAULT_MICROSCOPE_OPTIONS.keys,
      }),
    ).resolves.toBeUndefined();
    expect(ui.notifications).toEqual(["File picker received duplicate result rows"]);
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
  test("mode keys load git, grep, and project modes", async () => {
    const modes: string[] = [];
    const component = new MultiSelectPickerComponent(
      "src",
      async (mode) => {
        modes.push(mode);
        if (mode === "git-changed") return ok(changedCandidates);
        if (mode === "content-grep") return ok(grepCandidates);
        return ok(candidates);
      },
      candidates,
      { initialMode: "project-files", keys: DEFAULT_MICROSCOPE_OPTIONS.keys },
      () => {},
    );

    component.handleInput("\u0007");
    await Promise.resolve();
    expect(component.render(80)[0]).toContain("Git changed");
    expect(component.render(80).join("\n")).toContain("M src/index.ts");

    component.handleInput("\u0012");
    await Promise.resolve();
    expect(component.render(80)[0]).toContain("Content grep");
    expect(component.render(80).join("\n")).toContain("src/index.ts:10");

    component.handleInput("\u0006");
    await Promise.resolve();
    expect(component.render(80)[0]).toContain("Project files");
    expect(modes).toEqual(["git-changed", "content-grep", "project-files"]);
  });

  test("typing updates query and reloads current mode", async () => {
    const calls: Array<{ mode: string; query: string }> = [];
    const component = new MultiSelectPickerComponent(
      "",
      async (mode, query) => {
        calls.push({ mode, query });
        return ok(candidates.filter((candidate) => candidate.relativePath.includes(query)));
      },
      candidates,
      { initialMode: "project-files", keys: DEFAULT_MICROSCOPE_OPTIONS.keys },
      () => {},
    );

    component.handleInput("s");
    await Promise.resolve();
    expect(component.render(80)[0]).toContain("Query: s");

    component.handleInput("r");
    await Promise.resolve();
    expect(component.render(80)[0]).toContain("Query: sr");

    component.handleInput("\u007f");
    await Promise.resolve();
    expect(component.render(80)[0]).toContain("Query: s");
    expect(calls).toEqual([
      { mode: "project-files", query: "s" },
      { mode: "project-files", query: "sr" },
      { mode: "project-files", query: "s" },
    ]);
  });

  test("renders selected context budget and highlighted estimate", () => {
    const component = new MultiSelectPickerComponent(
      "src",
      async () => ok(candidates),
      candidates,
      {
        initialMode: "project-files",
        keys: DEFAULT_MICROSCOPE_OPTIONS.keys,
        contextBudget: { maxTokens: 1 },
      },
      () => {},
    );

    component.handleInput(" ");
    const rendered = component.render(120).join("\n");

    expect(rendered).toContain("Selected: 1");
    expect(rendered).toContain("Context: 1 files • 1 B • ~1 tokens / ~1 tokens");
    expect(rendered).toContain("Highlighted: 1 B • ~1 tokens");
  });

  test("renders over-budget warning for deduped grep selections", () => {
    const component = new MultiSelectPickerComponent(
      "run",
      async () => ok(grepCandidates),
      grepCandidates,
      {
        initialMode: "content-grep",
        keys: DEFAULT_MICROSCOPE_OPTIONS.keys,
        contextBudget: { maxTokens: 0 },
      },
      () => {},
    );

    component.handleInput(" ");
    component.handleInput("\u001b[B");
    component.handleInput(" ");
    const rendered = component.render(120).join("\n");

    expect(rendered).toContain("Selected: 1");
    expect(rendered).toContain("Context: 1 files • 2 B • ~1 tokens / ~0 tokens");
    expect(rendered).toContain("⚠ Selection exceeds context budget");
  });

  test("renders git-changed highlighted estimate", () => {
    const component = new MultiSelectPickerComponent(
      "src",
      async () => ok(changedCandidates),
      changedCandidates,
      { initialMode: "git-changed", keys: DEFAULT_MICROSCOPE_OPTIONS.keys },
      () => {},
    );

    expect(component.render(120).join("\n")).toContain("Highlighted: 8 B • ~2 tokens");
  });

  test("renders unavailable highlighted size", () => {
    const component = new MultiSelectPickerComponent(
      "src",
      async () => ok(changedCandidates),
      [{ ...changedCandidates[0]!, readable: false }],
      { initialMode: "git-changed", keys: DEFAULT_MICROSCOPE_OPTIONS.keys },
      () => {},
    );

    expect(component.render(120).join("\n")).toContain("Highlighted: size unavailable");
  });

  test("mode reload resets selected budget", async () => {
    const component = new MultiSelectPickerComponent(
      "src",
      async (mode) => {
        if (mode === "git-changed") return ok(changedCandidates);
        return ok(candidates);
      },
      candidates,
      { initialMode: "project-files", keys: DEFAULT_MICROSCOPE_OPTIONS.keys },
      () => {},
    );

    component.handleInput(" ");
    expect(component.render(120).join("\n")).toContain("Selected: 1");

    component.handleInput("\u0007");
    await Promise.resolve();

    expect(component.render(120).join("\n")).toContain("Selected: 0");
    expect(component.render(120).join("\n")).toContain("Context: 0 files • 0 B");
  });

  test("tab cycles through all picker modes", async () => {
    const modes: string[] = [];
    const component = new MultiSelectPickerComponent(
      "src",
      async (mode) => {
        modes.push(mode);
        if (mode === "git-changed") return ok(changedCandidates);
        if (mode === "content-grep") return ok(grepCandidates);
        return ok(candidates);
      },
      candidates,
      { initialMode: "project-files", keys: DEFAULT_MICROSCOPE_OPTIONS.keys },
      () => {},
    );

    component.handleInput("\t");
    await Promise.resolve();
    component.handleInput("\t");
    await Promise.resolve();
    component.handleInput("\t");
    await Promise.resolve();

    expect(component.render(80)[0]).toContain("Project files");
    expect(modes).toEqual(["git-changed", "content-grep", "project-files"]);
  });
});
