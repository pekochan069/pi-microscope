import type { Component, KeyId, TUI } from "@earendil-works/pi-tui";

import { matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

import type {
  MicroscopeContextBudgetOptions,
  MicroscopeKeys,
  MicroscopeOptions,
} from "./config.ts";
import type { SavedContextSet } from "./context-sets.ts";
import type { FileCandidate, FileSearchResult } from "./finder.ts";
import type { PreviewResult } from "./preview.ts";

import { createContextBudgetSummary, formatApproxTokens, formatBytes } from "./budget.ts";
import { normalizePathReference } from "./editor.ts";

interface CustomPickerOptions {
  overlay: boolean;
  overlayOptions?: {
    width?: number | `${number}%`;
    maxHeight?: number | `${number}%`;
  };
}

type CustomPickerFactory<T> = (
  tui: TUI,
  theme: unknown,
  keybindings: unknown,
  done: (value: T) => void,
) => Component;

export interface PickerUI {
  custom?<T>(factory: CustomPickerFactory<T>, options: CustomPickerOptions): Promise<T>;
  notify(message: string, type?: "info" | "warning" | "error"): void;
}

export type PickerMode = "project-files" | "git-changed" | "content-grep";

export const PICKER_MODE_LABELS: Record<PickerMode, string> = {
  "project-files": "Project files",
  "git-changed": "Git changed",
  "content-grep": "Content grep",
};

const PICKER_MODE_ORDER: PickerMode[] = ["project-files", "git-changed", "content-grep"];

export type LoadCandidates = (mode: PickerMode, query: string) => Promise<FileSearchResult>;
export type PreviewCandidate = (candidate: FileCandidate) => PreviewResult;
export type PickFilesResult = Array<string | FileCandidate>;

export interface ContextSetActions {
  list(): SavedContextSet[];
  save(name: string, paths: string[]): SavedContextSet;
  delete(name: string): boolean;
}

export interface PickerState {
  mode: PickerMode;
  highlightedIndex: number;
  selectedRowKeys: Set<string>;
  selectedReferencePaths: string[];
}

export interface PickFilesOptions {
  initialMode: PickerMode;
  keys: MicroscopeKeys;
  contextBudget?: MicroscopeContextBudgetOptions;
  preview?: PreviewCandidate;
  contextSets?: ContextSetActions;
  notify?: PickerUI["notify"];
}

export function createPickerState(mode: PickerMode = "project-files"): PickerState {
  return { mode, highlightedIndex: 0, selectedRowKeys: new Set(), selectedReferencePaths: [] };
}

export function moveHighlight(
  state: PickerState,
  candidates: FileCandidate[],
  delta: number,
): PickerState {
  if (candidates.length === 0) return state;

  const lastIndex = candidates.length - 1;
  const nextIndex = Math.min(lastIndex, Math.max(0, state.highlightedIndex + delta));
  return { ...state, highlightedIndex: nextIndex };
}

export function switchPickerMode(state: PickerState, mode: PickerMode): PickerState {
  if (state.mode === mode) return state;
  return createPickerState(mode);
}

export function getNextPickerMode(mode: PickerMode): PickerMode {
  const index = PICKER_MODE_ORDER.indexOf(mode);
  return PICKER_MODE_ORDER[(index + 1) % PICKER_MODE_ORDER.length]!;
}

export function toggleHighlightedCandidate(
  state: PickerState,
  candidates: FileCandidate[],
): PickerState {
  const candidate = candidates[state.highlightedIndex];
  if (!candidate) return state;

  const selectedRowKeys = new Set(state.selectedRowKeys);
  const rowKey = getCandidateSelectionKey(candidate);
  const referencePath = normalizePathReference(candidate.relativePath);
  let selectedReferencePaths = [...state.selectedReferencePaths];

  if (selectedRowKeys.has(rowKey)) {
    selectedRowKeys.delete(rowKey);
    const hasOtherSelectedRowForPath = candidates.some(
      (item) =>
        getCandidateSelectionKey(item) !== rowKey &&
        selectedRowKeys.has(getCandidateSelectionKey(item)) &&
        normalizePathReference(item.relativePath) === referencePath,
    );
    if (!hasOtherSelectedRowForPath) {
      selectedReferencePaths = selectedReferencePaths.filter((path) => path !== referencePath);
    }
  } else {
    selectedRowKeys.add(rowKey);
    if (!selectedReferencePaths.includes(referencePath)) selectedReferencePaths.push(referencePath);
  }

  return { ...state, selectedRowKeys, selectedReferencePaths };
}

export function replaceSelectionWithPaths(
  state: PickerState,
  paths: string[],
  candidates: FileCandidate[],
): PickerState {
  const selectedReferencePaths = dedupeReferencePaths(paths);
  const selectedPathSet = new Set(selectedReferencePaths);
  const selectedRowKeys = new Set<string>();
  for (const candidate of candidates) {
    if (selectedPathSet.has(normalizePathReference(candidate.relativePath))) {
      selectedRowKeys.add(getCandidateSelectionKey(candidate));
    }
  }
  return { ...state, selectedRowKeys, selectedReferencePaths };
}

export function getSelectedCount(state: PickerState): number {
  return state.selectedReferencePaths.length;
}

export function confirmPickerSelection(
  state: PickerState,
  candidates: FileCandidate[],
): PickFilesResult | undefined {
  if (state.selectedReferencePaths.length > 0) return [...state.selectedReferencePaths];
  if (candidates.length === 0) return undefined;

  const highlighted = candidates[state.highlightedIndex];
  return highlighted ? [normalizePathReference(highlighted.relativePath)] : undefined;
}

export function renderCandidateRows(
  candidates: FileCandidate[],
  state: PickerState,
  width: number,
  maxVisible = 12,
): string[] {
  const start = getViewportStart(state.highlightedIndex, candidates.length, maxVisible);
  const visibleCandidates = candidates.slice(start, start + maxVisible);

  return visibleCandidates.map((candidate, index) => {
    const candidateIndex = start + index;
    const pointer = candidateIndex === state.highlightedIndex ? ">" : " ";
    const marker = isCandidateSelected(candidate, state) ? "[x]" : "[ ]";
    const status = formatCandidateStatus(candidate);
    const row = `${pointer} ${marker} ${status}${formatCandidateLabel(candidate)}`;
    return truncateToWidth(row, width);
  });
}

export async function pickFiles(
  ui: PickerUI,
  loadCandidates: LoadCandidates,
  query = "",
  options: PickFilesOptions,
): Promise<PickFilesResult | undefined> {
  const initial = await loadCandidates(options.initialMode, query);
  if (initial.status === "error") {
    ui.notify(
      `Could not load ${PICKER_MODE_LABELS[options.initialMode]}: ${initial.message}`,
      "error",
    );
    return undefined;
  }

  if (initial.status === "empty") {
    ui.notify(initial.message, "warning");
    return undefined;
  }

  if (!validateCandidates(ui, initial.candidates)) return undefined;

  if (!ui.custom) {
    ui.notify("Multi-select file picker requires custom UI", "error");
    return undefined;
  }

  return ui.custom<PickFilesResult | undefined>(
    (tui, _theme, _keybindings, done) =>
      new MultiSelectPickerComponent(
        query,
        loadCandidates,
        initial.candidates,
        { ...options, notify: options.notify ?? ui.notify.bind(ui) },
        done,
        () => tui.requestRender(true),
      ),
    {
      overlay: true,
      overlayOptions: { width: "80%", maxHeight: "80%" },
    },
  );
}

type PickerActionMode =
  | { type: "normal" }
  | { type: "save"; name: string }
  | { type: "load"; highlightedIndex: number }
  | { type: "delete"; highlightedIndex: number };

export class MultiSelectPickerComponent implements Component {
  private state: PickerState;
  private candidates: FileCandidate[];
  private message = "";
  private requestId = 0;
  private actionMode: PickerActionMode = { type: "normal" };

  constructor(
    private query: string,
    private readonly loadCandidates: LoadCandidates,
    initialCandidates: FileCandidate[],
    private readonly options: PickFilesOptions,
    private readonly done: (value: PickFilesResult | undefined) => void,
    private readonly requestRender: () => void = () => {},
  ) {
    this.state = createPickerState(options.initialMode);
    this.candidates = initialCandidates;
  }

  handleInput(data: string): void {
    if (this.actionMode.type !== "normal") {
      this.handleActionInput(data);
      return;
    }

    if (matchesAny(data, this.options.keys.saveContextSet)) {
      this.startSave();
      return;
    }

    if (matchesAny(data, this.options.keys.loadContextSet)) {
      this.startSetList("load");
      return;
    }

    if (matchesAny(data, this.options.keys.deleteContextSet)) {
      this.startSetList("delete");
      return;
    }

    if (matchesAny(data, this.options.keys.up)) {
      this.state = moveHighlight(this.state, this.candidates, -1);
      return;
    }

    if (matchesAny(data, this.options.keys.down)) {
      this.state = moveHighlight(this.state, this.candidates, 1);
      return;
    }

    if (matchesAny(data, this.options.keys.projectMode)) {
      void this.setMode("project-files");
      return;
    }

    if (matchesAny(data, this.options.keys.gitChangedMode)) {
      void this.setMode("git-changed");
      return;
    }

    if (matchesAny(data, this.options.keys.contentGrepMode)) {
      void this.setMode("content-grep");
      return;
    }

    if (matchesAny(data, this.options.keys.modeToggle)) {
      void this.setMode(getNextPickerMode(this.state.mode));
      return;
    }

    if (matchesAny(data, this.options.keys.toggleSelect)) {
      this.state = toggleHighlightedCandidate(this.state, this.candidates);
      return;
    }

    if (matchesAny(data, this.options.keys.confirm)) {
      this.done(confirmPickerSelection(this.state, this.candidates));
      return;
    }

    if (matchesAny(data, this.options.keys.cancel)) {
      this.done(undefined);
      return;
    }

    if (isBackspace(data)) {
      if (this.query.length === 0) return;
      this.query = this.query.slice(0, -1);
      void this.reloadCandidates(true);
      return;
    }

    const text = getPrintableInput(data);
    if (text) {
      this.query += text;
      void this.reloadCandidates(true);
    }
  }

  invalidate(): void {}

  render(width: number): string[] {
    const safeWidth = Math.max(20, width);
    if (this.actionMode.type !== "normal") return this.renderAction(safeWidth);

    const budget = this.getBudgetSummary();
    const savedCount = this.options.contextSets?.list().length ?? 0;
    const header = `${PICKER_MODE_LABELS[this.state.mode]} • Query: ${this.query || "∅"} • Selected: ${budget.selected.fileCount} • Saved sets: ${savedCount}`;
    const budgetLines = this.renderBudgetLines(safeWidth, budget);
    const rows =
      this.candidates.length > 0
        ? renderCandidateRows(this.candidates, this.state, safeWidth, 12)
        : [truncateToWidth(this.message || "No files", safeWidth)];
    const preview = this.renderPreview(safeWidth);
    const footer = `Type search • Backspace edit • ${this.options.keys.modeToggle[0]} next • ${this.options.keys.projectMode[0]} project • ${this.options.keys.gitChangedMode[0]} git • ${this.options.keys.contentGrepMode[0]} grep • ${this.options.keys.saveContextSet[0]} save • ${this.options.keys.loadContextSet[0]} load • ${this.options.keys.deleteContextSet[0]} delete • ↑↓ move • Space select • Enter insert • Esc cancel`;

    return [
      truncateToWidth(header, safeWidth),
      ...budgetLines,
      "─".repeat(Math.min(safeWidth, 80)),
      ...rows,
      "─".repeat(Math.min(safeWidth, 80)),
      ...preview,
      "─".repeat(Math.min(safeWidth, 80)),
      truncateToWidth(footer, safeWidth),
    ];
  }

  private handleActionInput(data: string): void {
    if (matchesAny(data, this.options.keys.cancel)) {
      this.actionMode = { type: "normal" };
      this.message = "";
      this.requestRender();
      return;
    }

    if (this.actionMode.type === "save") {
      this.handleSaveInput(data);
      return;
    }

    if (this.actionMode.type === "load" || this.actionMode.type === "delete") {
      this.handleSetListInput(data, this.actionMode.type);
    }
  }

  private handleSaveInput(data: string): void {
    if (matchesAny(data, this.options.keys.confirm)) {
      this.saveCurrentSelection(this.actionMode.type === "save" ? this.actionMode.name : "");
      return;
    }

    if (isBackspace(data)) {
      if (this.actionMode.type === "save" && this.actionMode.name.length > 0) {
        this.actionMode = { type: "save", name: this.actionMode.name.slice(0, -1) };
        this.requestRender();
      }
      return;
    }

    const text = getPrintableInput(data);
    if (text && this.actionMode.type === "save") {
      this.actionMode = { type: "save", name: this.actionMode.name + text };
      this.requestRender();
    }
  }

  private handleSetListInput(data: string, type: "load" | "delete"): void {
    const sets = this.options.contextSets?.list() ?? [];
    if (sets.length === 0) {
      this.actionMode = { type: "normal" };
      return;
    }

    const highlightedIndex = this.actionMode.type === type ? this.actionMode.highlightedIndex : 0;
    if (matchesAny(data, this.options.keys.up)) {
      this.actionMode = { type, highlightedIndex: Math.max(0, highlightedIndex - 1) };
      this.requestRender();
      return;
    }

    if (matchesAny(data, this.options.keys.down)) {
      this.actionMode = { type, highlightedIndex: Math.min(sets.length - 1, highlightedIndex + 1) };
      this.requestRender();
      return;
    }

    if (!matchesAny(data, this.options.keys.confirm)) return;

    const selectedSet = sets[highlightedIndex];
    if (!selectedSet) return;

    if (type === "load") {
      this.state = replaceSelectionWithPaths(this.state, selectedSet.paths, this.candidates);
      this.message = `Loaded context set "${selectedSet.name}"`;
      this.notify(this.message, "info");
    } else {
      this.options.contextSets?.delete(selectedSet.name);
      this.message = `Deleted context set "${selectedSet.name}"`;
      this.notify(this.message, "info");
    }

    this.actionMode = { type: "normal" };
    this.requestRender();
  }

  private startSave(): void {
    if (!this.options.contextSets) {
      this.notify("Saved context sets are unavailable", "error");
      return;
    }

    if (this.state.selectedReferencePaths.length === 0) {
      this.notify("Select at least one file before saving a context set", "warning");
      return;
    }

    this.actionMode = { type: "save", name: "" };
    this.requestRender();
  }

  private startSetList(type: "load" | "delete"): void {
    if (!this.options.contextSets) {
      this.notify("Saved context sets are unavailable", "error");
      return;
    }

    if (this.options.contextSets.list().length === 0) {
      this.notify("No saved context sets exist", "warning");
      return;
    }

    this.actionMode = { type, highlightedIndex: 0 };
    this.requestRender();
  }

  private saveCurrentSelection(name: string): void {
    try {
      this.options.contextSets?.save(name, this.state.selectedReferencePaths);
    } catch (error) {
      this.notify(getErrorMessage(error), "error");
      return;
    }

    this.message = `Saved context set "${name.trim()}"`;
    this.notify(this.message, "info");
    this.actionMode = { type: "normal" };
    this.requestRender();
  }

  private renderAction(width: number): string[] {
    if (this.actionMode.type === "save") {
      return [
        truncateToWidth("Save context set", width),
        "─".repeat(Math.min(width, 80)),
        truncateToWidth(`Name: ${this.actionMode.name || "∅"}`, width),
        truncateToWidth("Type name • Enter save • Esc cancel", width),
      ];
    }

    const sets = this.options.contextSets?.list() ?? [];
    const type = this.actionMode.type;
    const highlightedIndex =
      type === "load" || type === "delete" ? this.actionMode.highlightedIndex : 0;
    const title = type === "delete" ? "Delete context set" : "Load context set";
    const rows = sets.map((set, index) => {
      const pointer = index === highlightedIndex ? ">" : " ";
      return truncateToWidth(`${pointer} ${formatSavedContextSet(set)}`, width);
    });

    return [
      truncateToWidth(title, width),
      "─".repeat(Math.min(width, 80)),
      ...(rows.length > 0 ? rows : [truncateToWidth("No saved context sets", width)]),
      "─".repeat(Math.min(width, 80)),
      truncateToWidth("↑↓ move • Enter confirm • Esc cancel", width),
    ];
  }

  private async setMode(mode: PickerMode): Promise<void> {
    if (mode === this.state.mode) return;

    this.state = switchPickerMode(this.state, mode);
    await this.reloadCandidates(false);
  }

  private async reloadCandidates(clearSelection: boolean): Promise<void> {
    const requestId = ++this.requestId;
    const mode = this.state.mode;
    this.state = {
      ...this.state,
      highlightedIndex: 0,
      ...(clearSelection ? { selectedRowKeys: new Set<string>(), selectedReferencePaths: [] } : {}),
    };
    this.candidates = [];
    this.message = `Loading ${PICKER_MODE_LABELS[mode]}…`;
    this.requestRender();

    const result = await this.loadCandidates(mode, this.query);
    if (requestId !== this.requestId) return;

    if (result.status === "ok") {
      this.candidates = result.candidates;
      this.state = replaceSelectionWithPaths(
        this.state,
        this.state.selectedReferencePaths,
        this.candidates,
      );
      this.message = "";
      this.requestRender();
      return;
    }

    this.candidates = [];
    this.message = result.message;
    this.requestRender();
  }

  private getBudgetSummary() {
    return createContextBudgetSummary({
      selectedCandidates: getSelectedCandidates(this.state, this.candidates),
      highlightedCandidate: this.candidates[this.state.highlightedIndex],
      maxTokens: this.options.contextBudget?.maxTokens ?? 24_000,
    });
  }

  private renderBudgetLines(
    width: number,
    budget: ReturnType<typeof createContextBudgetSummary>,
  ): string[] {
    const selected = `Context: ${budget.selected.fileCount} files • ${formatBytes(budget.selected.bytes)} • ~${formatApproxTokens(budget.selected.approxTokens)} / ~${formatApproxTokens(budget.maxTokens)}`;
    const unknown =
      budget.selected.unknownFileCount > 0
        ? ` • ${budget.selected.unknownFileCount} unknown size`
        : "";
    const highlighted = budget.highlighted
      ? `Highlighted: ${formatBytes(budget.highlighted.bytes)} • ~${formatApproxTokens(budget.highlighted.approxTokens)}`
      : "Highlighted: size unavailable";
    const lines = [
      truncateToWidth(`${selected}${unknown}`, width),
      truncateToWidth(highlighted, width),
    ];
    if (budget.isOverBudget) {
      lines.push(truncateToWidth("⚠ Selection exceeds context budget", width));
    }
    return lines;
  }

  private renderPreview(width: number): string[] {
    const candidate = this.candidates[this.state.highlightedIndex];
    if (!candidate || !this.options.preview) return [truncateToWidth("Preview unavailable", width)];

    const result = this.options.preview(candidate);
    if (result.status === "unavailable") return [truncateToWidth(result.message, width)];

    const startLine = result.startLine ?? 1;
    const lines = result.lines.slice(0, 6).map((line, index) => {
      const lineNumber = startLine + index;
      const numbered = `${String(lineNumber).padStart(3, " ")}  ${line}`;
      return truncateToWidth(numbered, width);
    });
    if (result.truncated) lines.push(truncateToWidth("…", width));
    return lines.length > 0 ? lines : [truncateToWidth("(empty file)", width)];
  }

  private notify(message: string, type?: "info" | "warning" | "error"): void {
    this.options.notify?.(message, type);
  }
}

export function pickerOptionsFromMicroscope(options: MicroscopeOptions): PickFilesOptions {
  return {
    initialMode: options.initialMode,
    keys: options.keys,
    contextBudget: options.contextBudget,
  };
}

function getSelectedCandidates(state: PickerState, candidates: FileCandidate[]): FileCandidate[] {
  if (state.selectedReferencePaths.length === 0) return [];
  const byPath = new Map<string, FileCandidate>();
  for (const candidate of candidates) {
    const path = normalizePathReference(candidate.relativePath);
    if (!byPath.has(path)) byPath.set(path, candidate);
  }

  return state.selectedReferencePaths.map(
    (path) => byPath.get(path) ?? createUnknownCandidate(path),
  );
}

function createUnknownCandidate(relativePath: string): FileCandidate {
  return {
    relativePath,
    fileName: relativePath.split("/").at(-1) ?? relativePath,
    gitStatus: "",
    size: 0,
    readable: false,
  };
}

function validateCandidates(ui: PickerUI, candidates: FileCandidate[]): boolean {
  const keys = candidates.map(getCandidateSelectionKey);
  if (new Set(keys).size !== keys.length) {
    ui.notify("File picker received duplicate result rows", "error");
    return false;
  }

  return true;
}

function isCandidateSelected(candidate: FileCandidate, state: PickerState): boolean {
  if (state.selectedRowKeys.has(getCandidateSelectionKey(candidate))) return true;
  return state.selectedReferencePaths.includes(normalizePathReference(candidate.relativePath));
}

function getCandidateSelectionKey(candidate: FileCandidate): string {
  return candidate.rowKey ?? candidate.relativePath;
}

function formatCandidateStatus(candidate: FileCandidate): string {
  if (!candidate.changeType) return "";
  const labels: Record<NonNullable<FileCandidate["changeType"]>, string> = {
    modified: "M ",
    added: "A ",
    deleted: "D ",
    renamed: "R ",
  };
  return labels[candidate.changeType];
}

function formatCandidateLabel(candidate: FileCandidate): string {
  if (candidate.lineNumber !== undefined) {
    return `${candidate.relativePath}:${candidate.lineNumber} ${candidate.lineSnippet ?? ""}`.trimEnd();
  }

  return `${candidate.relativePath}${formatRename(candidate)}`;
}

function formatRename(candidate: FileCandidate): string {
  return candidate.originalPath ? ` ← ${candidate.originalPath}` : "";
}

function formatSavedContextSet(set: SavedContextSet): string {
  const unknown = set.unknownFileCount > 0 ? ` • ${set.unknownFileCount} unknown size` : "";
  return `${set.name} • ${set.paths.length} files • ${formatBytes(set.bytes)} • ~${formatApproxTokens(set.approxTokens)}${unknown}`;
}

function matchesAny(data: string, keys: KeyId[]): boolean {
  return keys.some((key) => matchesKey(data, key));
}

function isBackspace(data: string): boolean {
  return data === "\u007f" || data === "\b";
}

function getPrintableInput(data: string): string | undefined {
  if (data.length === 0) return undefined;
  if ([...data].some((char) => char < " " || char === "\u007f")) return undefined;
  return data;
}

function getViewportStart(highlightedIndex: number, total: number, maxVisible: number): number {
  if (total <= maxVisible) return 0;
  const half = Math.floor(maxVisible / 2);
  return Math.min(total - maxVisible, Math.max(0, highlightedIndex - half));
}

function dedupeReferencePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const path of paths) {
    const normalized = normalizePathReference(path);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
