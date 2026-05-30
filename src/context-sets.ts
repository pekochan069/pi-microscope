import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { byteCountToApproxTokens } from "./budget.ts";
import { normalizePathReference } from "./editor.ts";

export const CONTEXT_SETS_VERSION = 1;

export interface ContextSetsFile {
  version: 1;
  sets: SavedContextSet[];
}

export interface SavedContextSet {
  name: string;
  paths: string[];
  bytes: number;
  approxTokens: number;
  unknownFileCount: number;
  updatedAt: string;
}

export interface SavedPathEstimate {
  bytes: number;
  approxTokens: number;
  unknownFileCount: number;
}

export function getContextSetsPath(projectRoot: string): string {
  return join(projectRoot, ".pi", "microscope", "context-sets.json");
}

export function loadContextSets(projectRoot: string): ContextSetsFile {
  const path = getContextSetsPath(projectRoot);
  if (!existsSync(path)) return emptyStore();

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parseContextSetsFile(parsed);
  } catch {
    return emptyStore();
  }
}

export function saveContextSet(
  projectRoot: string,
  name: string,
  relativePaths: string[],
  now = new Date(),
): SavedContextSet {
  const normalizedName = normalizeContextSetName(name);
  const paths = normalizeSavedPaths(relativePaths);
  if (paths.length === 0) throw new Error("At least one path is required");

  const estimate = estimateSavedPaths(projectRoot, paths);
  const saved: SavedContextSet = {
    name: normalizedName,
    paths,
    ...estimate,
    updatedAt: now.toISOString(),
  };

  const store = loadContextSets(projectRoot);
  const existingIndex = store.sets.findIndex((set) => set.name === normalizedName);
  const sets = [...store.sets];
  if (existingIndex >= 0) sets[existingIndex] = saved;
  else sets.push(saved);

  writeContextSets(projectRoot, { version: CONTEXT_SETS_VERSION, sets });
  return saved;
}

export function deleteContextSet(projectRoot: string, name: string): boolean {
  const normalizedName = normalizeContextSetName(name);
  const store = loadContextSets(projectRoot);
  const sets = store.sets.filter((set) => set.name !== normalizedName);
  if (sets.length === store.sets.length) return false;

  writeContextSets(projectRoot, { version: CONTEXT_SETS_VERSION, sets });
  return true;
}

export function normalizeContextSetName(name: string): string {
  const normalized = name.trim();
  if (normalized.length === 0) throw new Error("Context set name is required");
  return normalized;
}

export function normalizeSavedPaths(relativePaths: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const path of relativePaths) {
    const reference = normalizePathReference(path);
    if (seen.has(reference)) continue;
    seen.add(reference);
    normalized.push(reference);
  }
  return normalized;
}

export function estimateSavedPaths(
  projectRoot: string,
  relativePaths: string[],
): SavedPathEstimate {
  let bytes = 0;
  let unknownFileCount = 0;

  for (const relativePath of normalizeSavedPaths(relativePaths)) {
    try {
      const stats = statSync(join(projectRoot, relativePath));
      if (!stats.isFile()) {
        unknownFileCount++;
        continue;
      }
      bytes += stats.size;
    } catch {
      unknownFileCount++;
    }
  }

  return { bytes, approxTokens: byteCountToApproxTokens(bytes), unknownFileCount };
}

function writeContextSets(projectRoot: string, store: ContextSetsFile): void {
  const path = getContextSetsPath(projectRoot);
  mkdirSync(join(projectRoot, ".pi", "microscope"), { recursive: true });
  writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`);
}

function parseContextSetsFile(value: unknown): ContextSetsFile {
  if (!isRecord(value) || value.version !== CONTEXT_SETS_VERSION || !Array.isArray(value.sets)) {
    return emptyStore();
  }

  const sets: SavedContextSet[] = [];
  for (const item of value.sets) {
    const parsed = parseSavedContextSet(item);
    if (parsed) sets.push(parsed);
  }

  return { version: CONTEXT_SETS_VERSION, sets };
}

function parseSavedContextSet(value: unknown): SavedContextSet | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.name !== "string") return undefined;
  if (!Array.isArray(value.paths) || !value.paths.every((path) => typeof path === "string")) {
    return undefined;
  }
  if (typeof value.bytes !== "number" || !Number.isFinite(value.bytes) || value.bytes < 0) {
    return undefined;
  }
  if (
    typeof value.approxTokens !== "number" ||
    !Number.isFinite(value.approxTokens) ||
    value.approxTokens < 0
  ) {
    return undefined;
  }
  if (
    typeof value.unknownFileCount !== "number" ||
    !Number.isInteger(value.unknownFileCount) ||
    value.unknownFileCount < 0
  ) {
    return undefined;
  }
  if (typeof value.updatedAt !== "string") return undefined;

  try {
    return {
      name: normalizeContextSetName(value.name),
      paths: normalizeSavedPaths(value.paths),
      bytes: value.bytes,
      approxTokens: value.approxTokens,
      unknownFileCount: value.unknownFileCount,
      updatedAt: value.updatedAt,
    };
  } catch {
    return undefined;
  }
}

function emptyStore(): ContextSetsFile {
  return { version: CONTEXT_SETS_VERSION, sets: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
