/// <reference types="bun-types/test-globals" />

import {
  DEFAULT_MICROSCOPE_OPTIONS,
  normalizeKeySequence,
  resolveMicroscopeOptions,
} from "../src/config.ts";

describe("microscope config", () => {
  test("uses defaults when settings are absent", () => {
    expect(resolveMicroscopeOptions(undefined).options).toEqual(DEFAULT_MICROSCOPE_OPTIONS);
  });

  test("project settings override global settings field by field", () => {
    const result = resolveMicroscopeOptions(
      {
        piMicroscope: {
          shortcut: "ctrl+p",
          keys: { gitChangedMode: ["<C-x>"], saveContextSet: ["<A-s>"] },
        },
      },
      { piMicroscope: { keys: { projectMode: ["<C-f>"] }, preview: { maxLines: 20 } } },
    );

    expect(result.warnings).toEqual([]);
    expect(result.options.shortcut).toBe("ctrl+p");
    expect(result.options.keys.gitChangedMode).toEqual(["ctrl+x"]);
    expect(result.options.keys.projectMode).toEqual(["ctrl+f"]);
    expect(result.options.keys.saveContextSet).toEqual(["alt+s"]);
    expect(result.options.preview.maxLines).toBe(20);
    expect(result.options.preview.maxBytes).toBe(DEFAULT_MICROSCOPE_OPTIONS.preview.maxBytes);
  });

  test("supports context budget overrides and project precedence", () => {
    const result = resolveMicroscopeOptions(
      { piMicroscope: { contextBudget: { maxTokens: 12000 } } },
      { piMicroscope: { contextBudget: { maxTokens: 32000 } } },
    );

    expect(result.warnings).toEqual([]);
    expect(result.options.contextBudget.maxTokens).toBe(32000);
  });

  test("supports disabling shortcut", () => {
    const result = resolveMicroscopeOptions({ piMicroscope: { shortcut: false } });
    expect(result.options.shortcut).toBe(false);
  });

  test("supports content grep as initial mode", () => {
    const result = resolveMicroscopeOptions({ piMicroscope: { initialMode: "content-grep" } });

    expect(result.warnings).toEqual([]);
    expect(result.options.initialMode).toBe("content-grep");
  });

  test("includes default content grep and saved-set keys", () => {
    expect(DEFAULT_MICROSCOPE_OPTIONS.keys.contentGrepMode).toEqual(["ctrl+r"]);
    expect(DEFAULT_MICROSCOPE_OPTIONS.keys.modeToggle).toEqual(["tab"]);
    expect(DEFAULT_MICROSCOPE_OPTIONS.keys.saveContextSet).toEqual(["alt+s"]);
    expect(DEFAULT_MICROSCOPE_OPTIONS.keys.loadContextSet).toEqual(["alt+l"]);
    expect(DEFAULT_MICROSCOPE_OPTIONS.keys.deleteContextSet).toEqual(["alt+d"]);
  });

  test("normalizes Vim-style key notation", () => {
    expect(normalizeKeySequence("<C-g>")).toBe("ctrl+g");
    expect(normalizeKeySequence("<A-S-x>")).toBe("alt+shift+x");
  });

  test("invalid fields warn and preserve defaults", () => {
    const result = resolveMicroscopeOptions({
      piMicroscope: {
        shortcut: 123,
        pageSize: 0,
        keys: { projectMode: [] },
        preview: { maxBytes: -1, enabled: "yes" },
        contextBudget: { maxTokens: 0 },
      },
    });

    expect(result.options.shortcut).toBe(DEFAULT_MICROSCOPE_OPTIONS.shortcut);
    expect(result.options.pageSize).toBe(DEFAULT_MICROSCOPE_OPTIONS.pageSize);
    expect(result.options.keys.projectMode).toEqual(DEFAULT_MICROSCOPE_OPTIONS.keys.projectMode);
    expect(result.options.preview).toEqual(DEFAULT_MICROSCOPE_OPTIONS.preview);
    expect(result.options.contextBudget).toEqual(DEFAULT_MICROSCOPE_OPTIONS.contextBudget);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
