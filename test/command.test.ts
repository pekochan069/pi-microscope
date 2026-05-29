/// <reference types="bun-types/test-globals" />

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

import type { FileCandidate, FinderService, FileSearchResult } from "../src/finder.ts";

import { createMicroscopeHandler, type PickFiles } from "../src/command.ts";

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

function createFinder(result: FileSearchResult): FinderService {
  return {
    search: async () => result,
    destroy: () => {},
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
      finder: createFinder({ status: "ok", candidates: [candidate] }),
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
      finder: createFinder({ status: "ok", candidates: [candidate, secondCandidate] }),
      pickFiles: picker,
    });
    const state = createContext(true, "inspect");

    await command("src", state.ctx);

    expect(state.setEditorTextCalls).toEqual(["inspect @src/index.ts @src/finder.ts"]);
    expect(state.notifications).toEqual([{ message: "Inserted 2 file references", type: "info" }]);
  });

  test("cancel path leaves editor unchanged", async () => {
    const picker: PickFiles = async () => undefined;
    const command = createMicroscopeHandler({
      finder: createFinder({ status: "ok", candidates: [candidate] }),
      pickFiles: picker,
    });
    const state = createContext(true, "keep");

    await command("src", state.ctx);

    expect(state.text).toBe("keep");
    expect(state.setEditorTextCalls).toEqual([]);
    expect(state.notifications).toEqual([]);
  });

  test("no-result path leaves editor unchanged and notifies", async () => {
    const command = createMicroscopeHandler({
      finder: createFinder({ status: "empty", message: 'No files matched "none"' }),
    });
    const state = createContext(true, "keep");

    await command("none", state.ctx);

    expect(state.text).toBe("keep");
    expect(state.setEditorTextCalls).toEqual([]);
    expect(state.notifications).toEqual([{ message: 'No files matched "none"', type: "warning" }]);
  });

  test("finder-error path leaves editor unchanged and notifies", async () => {
    const command = createMicroscopeHandler({
      finder: createFinder({ status: "error", message: "boom" }),
    });
    const state = createContext(true, "keep");

    await command("src", state.ctx);

    expect(state.text).toBe("keep");
    expect(state.setEditorTextCalls).toEqual([]);
    expect(state.notifications).toEqual([
      { message: "Could not search files: boom", type: "error" },
    ]);
  });

  test("insert-error path leaves editor unchanged and notifies", async () => {
    const invalidCandidate: FileCandidate = { ...candidate, relativePath: "../outside.ts" };
    const picker: PickFiles = async () => [invalidCandidate];
    const command = createMicroscopeHandler({
      finder: createFinder({ status: "ok", candidates: [invalidCandidate] }),
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
    const command = createMicroscopeHandler({
      finder: createFinder({ status: "ok", candidates: [candidate] }),
    });
    const state = createContext(false, "keep");

    await command("src", state.ctx);

    expect(state.text).toBe("keep");
    expect(state.setEditorTextCalls).toEqual([]);
    expect(state.notifications).toEqual([
      { message: "/microscope requires interactive UI", type: "error" },
    ]);
  });
});
