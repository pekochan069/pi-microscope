import type { KeyId } from "@earendil-works/pi-tui";

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { PickerMode } from "./picker.ts";

export interface MicroscopeKeys {
  projectMode: KeyId[];
  gitChangedMode: KeyId[];
  contentGrepMode: KeyId[];
  modeToggle: KeyId[];
  up: KeyId[];
  down: KeyId[];
  toggleSelect: KeyId[];
  confirm: KeyId[];
  cancel: KeyId[];
}

export interface MicroscopePreviewOptions {
  enabled: boolean;
  maxBytes: number;
  maxLines: number;
}

export interface MicroscopeContextBudgetOptions {
  maxTokens: number;
}

export interface MicroscopeOptions {
  shortcut: KeyId | false;
  initialMode: PickerMode;
  pageSize: number;
  keys: MicroscopeKeys;
  preview: MicroscopePreviewOptions;
  contextBudget: MicroscopeContextBudgetOptions;
}

export interface MicroscopeConfigPaths {
  globalSettingsPath?: string;
  projectSettingsPath?: string;
}

export interface MicroscopeConfigLoadResult {
  options: MicroscopeOptions;
  warnings: string[];
}

type PartialMicroscopeOptions = Partial<
  Omit<MicroscopeOptions, "keys" | "preview" | "contextBudget">
> & {
  keys?: Partial<MicroscopeKeys>;
  preview?: Partial<MicroscopePreviewOptions>;
  contextBudget?: Partial<MicroscopeContextBudgetOptions>;
};

const MODES = new Set<PickerMode>(["project-files", "git-changed", "content-grep"]);

export const DEFAULT_MICROSCOPE_OPTIONS: MicroscopeOptions = Object.freeze({
  shortcut: "ctrl+f",
  initialMode: "project-files",
  pageSize: 100,
  keys: Object.freeze({
    projectMode: Object.freeze(["ctrl+f"]),
    gitChangedMode: Object.freeze(["ctrl+g"]),
    contentGrepMode: Object.freeze(["ctrl+r"]),
    modeToggle: Object.freeze(["tab"]),
    up: Object.freeze(["up", "ctrl+p"]),
    down: Object.freeze(["down", "ctrl+n"]),
    toggleSelect: Object.freeze(["space"]),
    confirm: Object.freeze(["enter"]),
    cancel: Object.freeze(["escape", "ctrl+c"]),
  }) as MicroscopeKeys,
  preview: Object.freeze({
    enabled: true,
    maxBytes: 50_000,
    maxLines: 200,
  }),
  contextBudget: Object.freeze({
    maxTokens: 24_000,
  }),
}) as MicroscopeOptions;

export function defaultMicroscopeConfigPaths(cwd = process.cwd()): Required<MicroscopeConfigPaths> {
  return {
    globalSettingsPath: join(homedir(), ".pi", "agent", "settings.json"),
    projectSettingsPath: join(cwd, ".pi", "settings.json"),
  };
}

export function loadMicroscopeOptions(
  cwd = process.cwd(),
  paths: MicroscopeConfigPaths = {},
): MicroscopeConfigLoadResult {
  const defaults = defaultMicroscopeConfigPaths(cwd);
  const globalSettings = readJsonIfExists(paths.globalSettingsPath ?? defaults.globalSettingsPath);
  const projectSettings = readJsonIfExists(
    paths.projectSettingsPath ?? defaults.projectSettingsPath,
  );
  return resolveMicroscopeOptions(globalSettings, projectSettings);
}

export function resolveMicroscopeOptions(
  globalSettings: unknown,
  projectSettings?: unknown,
): MicroscopeConfigLoadResult {
  const options = cloneDefaultOptions();
  const warnings: string[] = [];

  const globalParsed = parsePiMicroscope(
    isRecord(globalSettings) ? globalSettings.piMicroscope : undefined,
    "global settings",
  );
  warnings.push(...globalParsed.warnings);
  mergePartialOptions(options, globalParsed.partial);

  const projectParsed = parsePiMicroscope(
    isRecord(projectSettings) ? projectSettings.piMicroscope : undefined,
    "project settings",
  );
  warnings.push(...projectParsed.warnings);
  mergePartialOptions(options, projectParsed.partial);

  return { options, warnings };
}

function cloneDefaultOptions(): MicroscopeOptions {
  return {
    shortcut: DEFAULT_MICROSCOPE_OPTIONS.shortcut,
    initialMode: DEFAULT_MICROSCOPE_OPTIONS.initialMode,
    pageSize: DEFAULT_MICROSCOPE_OPTIONS.pageSize,
    keys: {
      projectMode: [...DEFAULT_MICROSCOPE_OPTIONS.keys.projectMode],
      gitChangedMode: [...DEFAULT_MICROSCOPE_OPTIONS.keys.gitChangedMode],
      contentGrepMode: [...DEFAULT_MICROSCOPE_OPTIONS.keys.contentGrepMode],
      modeToggle: [...DEFAULT_MICROSCOPE_OPTIONS.keys.modeToggle],
      up: [...DEFAULT_MICROSCOPE_OPTIONS.keys.up],
      down: [...DEFAULT_MICROSCOPE_OPTIONS.keys.down],
      toggleSelect: [...DEFAULT_MICROSCOPE_OPTIONS.keys.toggleSelect],
      confirm: [...DEFAULT_MICROSCOPE_OPTIONS.keys.confirm],
      cancel: [...DEFAULT_MICROSCOPE_OPTIONS.keys.cancel],
    },
    preview: { ...DEFAULT_MICROSCOPE_OPTIONS.preview },
    contextBudget: { ...DEFAULT_MICROSCOPE_OPTIONS.contextBudget },
  };
}

function parsePiMicroscope(
  value: unknown,
  source: string,
): { partial: PartialMicroscopeOptions; warnings: string[] } {
  const partial: PartialMicroscopeOptions = {};
  const warnings: string[] = [];
  if (value === undefined) return { partial, warnings };
  if (!isRecord(value)) {
    warnings.push(`${source}: piMicroscope must be an object`);
    return { partial, warnings };
  }

  if ("shortcut" in value) {
    if (value.shortcut === false) {
      partial.shortcut = false;
    } else {
      const shortcut = normalizeKeySequence(value.shortcut);
      if (shortcut) partial.shortcut = shortcut;
      else warnings.push(`${source}: piMicroscope.shortcut must be a key string or false`);
    }
  }

  if ("initialMode" in value) {
    if (typeof value.initialMode === "string" && MODES.has(value.initialMode as PickerMode)) {
      partial.initialMode = value.initialMode as PickerMode;
    } else {
      warnings.push(
        `${source}: piMicroscope.initialMode must be project-files, git-changed, or content-grep`,
      );
    }
  }

  if ("pageSize" in value) {
    const pageSize = value.pageSize;
    if (typeof pageSize === "number" && Number.isInteger(pageSize) && pageSize > 0) {
      partial.pageSize = pageSize;
    } else {
      warnings.push(`${source}: piMicroscope.pageSize must be a positive integer`);
    }
  }

  if ("keys" in value) {
    const parsed = parseKeys(value.keys, source);
    partial.keys = parsed.partial;
    warnings.push(...parsed.warnings);
  }

  if ("preview" in value) {
    const parsed = parsePreview(value.preview, source);
    partial.preview = parsed.partial;
    warnings.push(...parsed.warnings);
  }

  if ("contextBudget" in value) {
    const parsed = parseContextBudget(value.contextBudget, source);
    partial.contextBudget = parsed.partial;
    warnings.push(...parsed.warnings);
  }

  return { partial, warnings };
}

function parseKeys(
  value: unknown,
  source: string,
): { partial: Partial<MicroscopeKeys>; warnings: string[] } {
  const partial: Partial<MicroscopeKeys> = {};
  const warnings: string[] = [];
  if (!isRecord(value)) {
    warnings.push(`${source}: piMicroscope.keys must be an object`);
    return { partial, warnings };
  }

  for (const keyName of Object.keys(DEFAULT_MICROSCOPE_OPTIONS.keys) as Array<
    keyof MicroscopeKeys
  >) {
    if (!(keyName in value)) continue;
    const keys = parseKeyArray(value[keyName]);
    if (keys.length > 0) partial[keyName] = keys;
    else warnings.push(`${source}: piMicroscope.keys.${keyName} must be a non-empty key array`);
  }

  return { partial, warnings };
}

function parsePreview(
  value: unknown,
  source: string,
): { partial: Partial<MicroscopePreviewOptions>; warnings: string[] } {
  const partial: Partial<MicroscopePreviewOptions> = {};
  const warnings: string[] = [];
  if (!isRecord(value)) {
    warnings.push(`${source}: piMicroscope.preview must be an object`);
    return { partial, warnings };
  }

  if ("enabled" in value) {
    if (typeof value.enabled === "boolean") partial.enabled = value.enabled;
    else warnings.push(`${source}: piMicroscope.preview.enabled must be boolean`);
  }
  if ("maxBytes" in value) {
    const maxBytes = value.maxBytes;
    if (typeof maxBytes === "number" && Number.isInteger(maxBytes) && maxBytes > 0)
      partial.maxBytes = maxBytes;
    else warnings.push(`${source}: piMicroscope.preview.maxBytes must be a positive integer`);
  }
  if ("maxLines" in value) {
    const maxLines = value.maxLines;
    if (typeof maxLines === "number" && Number.isInteger(maxLines) && maxLines > 0)
      partial.maxLines = maxLines;
    else warnings.push(`${source}: piMicroscope.preview.maxLines must be a positive integer`);
  }

  return { partial, warnings };
}

function parseContextBudget(
  value: unknown,
  source: string,
): { partial: Partial<MicroscopeContextBudgetOptions>; warnings: string[] } {
  const partial: Partial<MicroscopeContextBudgetOptions> = {};
  const warnings: string[] = [];
  if (!isRecord(value)) {
    warnings.push(`${source}: piMicroscope.contextBudget must be an object`);
    return { partial, warnings };
  }

  if ("maxTokens" in value) {
    const maxTokens = value.maxTokens;
    if (typeof maxTokens === "number" && Number.isInteger(maxTokens) && maxTokens > 0)
      partial.maxTokens = maxTokens;
    else
      warnings.push(`${source}: piMicroscope.contextBudget.maxTokens must be a positive integer`);
  }

  return { partial, warnings };
}

function mergePartialOptions(options: MicroscopeOptions, partial: PartialMicroscopeOptions): void {
  if (partial.shortcut !== undefined) options.shortcut = partial.shortcut;
  if (partial.initialMode) options.initialMode = partial.initialMode;
  if (partial.pageSize) options.pageSize = partial.pageSize;
  if (partial.keys) Object.assign(options.keys, partial.keys);
  if (partial.preview) Object.assign(options.preview, partial.preview);
  if (partial.contextBudget) Object.assign(options.contextBudget, partial.contextBudget);
}

function parseKeyArray(value: unknown): KeyId[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeKeySequence).filter((key): key is KeyId => key !== undefined);
}

export function normalizeKeySequence(value: unknown): KeyId | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;

  const angleMatch = value.match(/^<(.+)>$/);
  if (!angleMatch) return value.toLowerCase() as KeyId;

  const parts = angleMatch[1]?.split("-").filter(Boolean) ?? [];
  if (parts.length === 0) return undefined;

  const key = parts.pop()?.toLowerCase();
  if (!key) return undefined;

  const modifiers = parts.map((part) => {
    const lower = part.toLowerCase();
    if (lower === "c" || lower === "ctrl" || lower === "control") return "ctrl";
    if (lower === "s" || lower === "shift") return "shift";
    if (lower === "a" || lower === "alt" || lower === "option") return "alt";
    if (lower === "m" || lower === "super" || lower === "cmd" || lower === "command")
      return "super";
    return lower;
  });

  return [...modifiers, normalizeSpecialKey(key)].join("+") as KeyId;
}

function normalizeSpecialKey(key: string): string {
  if (key === "esc") return "escape";
  if (key === "return") return "enter";
  return key;
}

function readJsonIfExists(path: string): unknown {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
