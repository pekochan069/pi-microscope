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
      { piMicroscope: { shortcut: "ctrl+p", keys: { gitChangedMode: ["<C-x>"] } } },
      { piMicroscope: { keys: { projectMode: ["<C-f>"] }, preview: { maxLines: 20 } } },
    );

    expect(result.warnings).toEqual([]);
    expect(result.options.shortcut).toBe("ctrl+p");
    expect(result.options.keys.gitChangedMode).toEqual(["ctrl+x"]);
    expect(result.options.keys.projectMode).toEqual(["ctrl+f"]);
    expect(result.options.preview.maxLines).toBe(20);
    expect(result.options.preview.maxBytes).toBe(DEFAULT_MICROSCOPE_OPTIONS.preview.maxBytes);
  });

  test("supports disabling shortcut", () => {
    const result = resolveMicroscopeOptions({ piMicroscope: { shortcut: false } });
    expect(result.options.shortcut).toBe(false);
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
      },
    });

    expect(result.options.shortcut).toBe(DEFAULT_MICROSCOPE_OPTIONS.shortcut);
    expect(result.options.pageSize).toBe(DEFAULT_MICROSCOPE_OPTIONS.pageSize);
    expect(result.options.keys.projectMode).toEqual(DEFAULT_MICROSCOPE_OPTIONS.keys.projectMode);
    expect(result.options.preview).toEqual(DEFAULT_MICROSCOPE_OPTIONS.preview);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
