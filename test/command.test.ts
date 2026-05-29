/// <reference types="bun-types/test-globals" />

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

import type { FileCandidate, FinderService, FileSearchResult } from "../src/finder.ts";

import { createMicroscopeHandler, type PickFiles } from "../src/command.ts";
import { DEFAULT_MICROSCOPE_OPTIONS } from "../src/config.ts";

const candidate: FileCandidate = {
  relativePath: "src/index.ts",
  fileName: "index.ts",
  gitStatus: "clean",
  size: 123,
};

const secondCandidate: FileCandidate = {
  relativePath: "src/finder.ts",
  fileName: "finder.ts",
  gitStatus: "clean",
  size: 456,
};

const renamedCandidate: FileCandidate = {
  relativePath: "src/new.ts",
  fileName: "new.ts",
  gitStatus: "R ",
  size: 0,
  changeType: "renamed",
  originalPath: "src/old.ts",
};

function createFinder(
  result: FileSearchResult,
  grepResult: FileSearchResult = result,
): FinderService {
  return {
    search: async () => result,
    grep: async () => grepResult,
    destroy: () => {},
  };
}

function createDependencies(
  result: FileSearchResult,
  gitResult: FileSearchResult = result,
  grepResult: FileSearchResult = result,
) {
  return {
    finder: createFinder(result, grepResult),
    gitChanged: { search: async () => gitResult },
    options: DEFAULT_MICROSCOPE_OPTIONS,
    basePath: "/repo",
  };
}

function createContext(hasUI = true, editorText = "hello") {
  const notifications: Array<{ message: string; type?: "info" | "warning" | "error" }> = [];
  const setEditorTextCalls: string[] = [];
  let text = editorText;
  const ctx = {
    hasUI,
    cwd: "/repo",
    ui: {
      notify: (message: string, type?: "info" | "warning" | "error") => {
        notifications.push({ message, type });
      },
      getEditorText: () => text,
      setEditorText: (nextText: string) => {
        text = nextText;
        setEditorTextCalls.push(nextText);
      },
    },
  } as unknown as ExtensionCommandContext;

  return {
    ctx,
    notifications,
    setEditorTextCalls,
    get text() {
      return text;
    },
  };
}

describe("createMicroscopeHandler", () => {
  test("single selected result mutates editor once and preserves prompt text", async () => {
    const picker: PickFiles = async () => [candidate];
    const command = createMicroscopeHandler({
      ...createDependencies({ status: "ok", candidates: [candidate] }),
      pickFiles: picker,
    });
    const state = createContext(true, "inspect");

    await command("src", state.ctx);

    expect(state.setEditorTextCalls).toEqual(["inspect @src/index.ts"]);
    expect(state.notifications).toEqual([{ message: "Inserted @src/index.ts", type: "info" }]);
  });

  test("multiple selected results mutate editor once and preserve prompt text", async () => {
    const picker: PickFiles = async () => [candidate, secondCandidate];
    const command = createMicroscopeHandler({
      ...createDependencies({ status: "ok", candidates: [candidate, secondCandidate] }),
      pickFiles: picker,
    });
    const state = createContext(true, "inspect");

    await command("src", state.ctx);

    expect(state.setEditorTextCalls).toEqual(["inspect @src/index.ts @src/finder.ts"]);
    expect(state.notifications).toEqual([{ message: "Inserted 2 file references", type: "info" }]);
  });

  test("content-grep result inserts matched file path", async () => {
    const grepCandidate: FileCandidate = {
      ...candidate,
      lineNumber: 12,
      lineSnippet: "createMicroscopeHandler",
      rowKey: "src/index.ts:12:0:120:0",
    };
    const picker: PickFiles = async (_ui, loadCandidates) => {
      const result = await loadCandidates("content-grep", "createMicroscopeHandler");
      return result.status === "ok" ? [result.candidates[0]!] : undefined;
    };
    const command = createMicroscopeHandler({
      ...createDependencies(
        { status: "ok", candidates: [candidate] },
        { status: "ok", candidates: [renamedCandidate] },
        { status: "ok", candidates: [grepCandidate] },
      ),
      pickFiles: picker,
    });
    const state = createContext(true, "inspect");

    await command("createMicroscopeHandler", state.ctx);

    expect(state.setEditorTextCalls).toEqual(["inspect @src/index.ts"]);
    expect(state.notifications).toEqual([{ message: "Inserted @src/index.ts", type: "info" }]);
  });

  test("duplicate content-grep rows insert one file reference", async () => {
    const picker: PickFiles = async () => [
      { ...candidate, lineNumber: 10, rowKey: "src/index.ts:10:0:100:0" },
      { ...candidate, lineNumber: 20, rowKey: "src/index.ts:20:0:200:1" },
      secondCandidate,
    ];
    const command = createMicroscopeHandler({
      ...createDependencies({ status: "ok", candidates: [candidate, secondCandidate] }),
      pickFiles: picker,
    });
    const state = createContext(true, "inspect");

    await command("src", state.ctx);

    expect(state.setEditorTextCalls).toEqual(["inspect @src/index.ts @src/finder.ts"]);
    expect(state.notifications).toEqual([{ message: "Inserted 2 file references", type: "info" }]);
  });

  test("git-changed renamed result inserts target path", async () => {
    const picker: PickFiles = async (_ui, loadCandidates) => {
      const result = await loadCandidates("git-changed", "src");
      return result.status === "ok" ? [result.candidates[0]!] : undefined;
    };
    const command = createMicroscopeHandler({
      ...createDependencies(
        { status: "ok", candidates: [candidate] },
        { status: "ok", candidates: [renamedCandidate] },
      ),
      pickFiles: picker,
    });
    const state = createContext(true, "inspect");

    await command("src", state.ctx);

    expect(state.setEditorTextCalls).toEqual(["inspect @src/new.ts"]);
    expect(state.notifications).toEqual([{ message: "Inserted @src/new.ts", type: "info" }]);
  });

  test("cancel path leaves editor unchanged", async () => {
    const picker: PickFiles = async () => undefined;
    const command = createMicroscopeHandler({
      ...createDependencies({ status: "ok", candidates: [candidate] }),
      pickFiles: picker,
    });
    const state = createContext(true, "keep");

    await command("src", state.ctx);

    expect(state.text).toBe("keep");
    expect(state.setEditorTextCalls).toEqual([]);
    expect(state.notifications).toEqual([]);
  });

  test("no-result path leaves editor unchanged and notifies", async () => {
    const command = createMicroscopeHandler(
      createDependencies({ status: "empty", message: 'No files matched "none"' }),
    );
    const state = createContext(true, "keep");

    await command("none", state.ctx);

    expect(state.text).toBe("keep");
    expect(state.setEditorTextCalls).toEqual([]);
    expect(state.notifications).toEqual([{ message: 'No files matched "none"', type: "warning" }]);
  });

  test("finder-error path leaves editor unchanged and notifies", async () => {
    const command = createMicroscopeHandler(
      createDependencies({ status: "error", message: "boom" }),
    );
    const state = createContext(true, "keep");

    await command("src", state.ctx);

    expect(state.text).toBe("keep");
    expect(state.setEditorTextCalls).toEqual([]);
    expect(state.notifications).toEqual([
      { message: "Could not load Project files: boom", type: "error" },
    ]);
  });

  test("insert-error path leaves editor unchanged and notifies", async () => {
    const invalidCandidate: FileCandidate = { ...candidate, relativePath: "../outside.ts" };
    const picker: PickFiles = async () => [invalidCandidate];
    const command = createMicroscopeHandler({
      ...createDependencies({ status: "ok", candidates: [invalidCandidate] }),
      pickFiles: picker,
    });
    const state = createContext(true, "keep");

    await command("src", state.ctx);

    expect(state.text).toBe("keep");
    expect(state.setEditorTextCalls).toEqual([]);
    expect(state.notifications).toEqual([
      {
        message: "Could not insert file references: Path reference cannot escape the workspace",
        type: "error",
      },
    ]);
  });

  test("non-UI mode leaves editor unchanged and reports requirement", async () => {
    const command = createMicroscopeHandler(
      createDependencies({ status: "ok", candidates: [candidate] }),
    );
    const state = createContext(false, "keep");

    await command("src", state.ctx);

    expect(state.text).toBe("keep");
    expect(state.setEditorTextCalls).toEqual([]);
    expect(state.notifications).toEqual([
      { message: "/microscope requires interactive UI", type: "error" },
    ]);
  });
});
