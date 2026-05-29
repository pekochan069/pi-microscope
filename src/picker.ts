import type { Component, KeyId, TUI } from "@earendil-works/pi-tui";

import { matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

import type {
  MicroscopeContextBudgetOptions,
  MicroscopeKeys,
  MicroscopeOptions,
} from "./config.ts";
import type { FileCandidate, FileSearchResult } from "./finder.ts";
import type { PreviewResult } from "./preview.ts";

import { createContextBudgetSummary, formatApproxTokens, formatBytes } from "./budget.ts";

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

export interface PickerState {
  mode: PickerMode;
  highlightedIndex: number;
  selectedPaths: Set<string>;
}

export interface PickFilesOptions {
  initialMode: PickerMode;
  keys: MicroscopeKeys;
  contextBudget?: MicroscopeContextBudgetOptions;
  preview?: PreviewCandidate;
}

export function createPickerState(mode: PickerMode = "project-files"): PickerState {
  return { mode, highlightedIndex: 0, selectedPaths: new Set() };
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
  return { mode, highlightedIndex: 0, selectedPaths: new Set() };
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

  const selectedPaths = new Set(state.selectedPaths);
  const selectionKey = getCandidateSelectionKey(candidate);
  if (selectedPaths.has(selectionKey)) {
    selectedPaths.delete(selectionKey);
  } else {
    selectedPaths.add(selectionKey);
  }

  return { ...state, selectedPaths };
}

export function getSelectedCount(state: PickerState): number {
  return state.selectedPaths.size;
}

export function confirmPickerSelection(
  state: PickerState,
  candidates: FileCandidate[],
): FileCandidate[] | undefined {
  if (candidates.length === 0) return undefined;

  if (state.selectedPaths.size > 0) {
    return candidates.filter((candidate) =>
      state.selectedPaths.has(getCandidateSelectionKey(candidate)),
    );
  }

  const highlighted = candidates[state.highlightedIndex];
  return highlighted ? [highlighted] : undefined;
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
    const marker = state.selectedPaths.has(getCandidateSelectionKey(candidate)) ? "[x]" : "[ ]";
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
): Promise<FileCandidate[] | undefined> {
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

  return ui.custom<FileCandidate[] | undefined>(
    (tui, _theme, _keybindings, done) =>
      new MultiSelectPickerComponent(query, loadCandidates, initial.candidates, options, done, () =>
        tui.requestRender(true),
      ),
    {
      overlay: true,
      overlayOptions: { width: "80%", maxHeight: "80%" },
    },
  );
}

export class MultiSelectPickerComponent implements Component {
  private state: PickerState;
  private candidates: FileCandidate[];
  private message = "";
  private requestId = 0;

  constructor(
    private query: string,
    private readonly loadCandidates: LoadCandidates,
    initialCandidates: FileCandidate[],
    private readonly options: PickFilesOptions,
    private readonly done: (value: FileCandidate[] | undefined) => void,
    private readonly requestRender: () => void = () => {},
  ) {
    this.state = createPickerState(options.initialMode);
    this.candidates = initialCandidates;
  }

  handleInput(data: string): void {
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
      void this.reloadCandidates();
      return;
    }

    const text = getPrintableInput(data);
    if (text) {
      this.query += text;
      void this.reloadCandidates();
    }
  }

  invalidate(): void {}

  render(width: number): string[] {
    const safeWidth = Math.max(20, width);
    const budget = this.getBudgetSummary();
    const header = `${PICKER_MODE_LABELS[this.state.mode]} • Query: ${this.query || "∅"} • Selected: ${budget.selected.fileCount}`;
    const budgetLines = this.renderBudgetLines(safeWidth, budget);
    const rows =
      this.candidates.length > 0
        ? renderCandidateRows(this.candidates, this.state, safeWidth, 12)
        : [truncateToWidth(this.message || "No files", safeWidth)];
    const preview = this.renderPreview(safeWidth);
    const footer = `Type search • Backspace edit • ${this.options.keys.modeToggle[0]} next • ${this.options.keys.projectMode[0]} project • ${this.options.keys.gitChangedMode[0]} git • ${this.options.keys.contentGrepMode[0]} grep • ↑↓ move • Space select • Enter insert • Esc cancel`;

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

  private async setMode(mode: PickerMode): Promise<void> {
    if (mode === this.state.mode) return;

    this.state = switchPickerMode(this.state, mode);
    await this.reloadCandidates();
  }

  private async reloadCandidates(): Promise<void> {
    const requestId = ++this.requestId;
    const mode = this.state.mode;
    this.state = { ...this.state, highlightedIndex: 0, selectedPaths: new Set() };
    this.candidates = [];
    this.message = `Loading ${PICKER_MODE_LABELS[mode]}…`;
    this.requestRender();

    const result = await this.loadCandidates(mode, this.query);
    if (requestId !== this.requestId) return;

    if (result.status === "ok") {
      this.candidates = result.candidates;
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
}

export function pickerOptionsFromMicroscope(options: MicroscopeOptions): PickFilesOptions {
  return {
    initialMode: options.initialMode,
    keys: options.keys,
    contextBudget: options.contextBudget,
  };
}

function getSelectedCandidates(state: PickerState, candidates: FileCandidate[]): FileCandidate[] {
  if (state.selectedPaths.size === 0) return [];
  return candidates.filter((candidate) =>
    state.selectedPaths.has(getCandidateSelectionKey(candidate)),
  );
}

function validateCandidates(ui: PickerUI, candidates: FileCandidate[]): boolean {
  const keys = candidates.map(getCandidateSelectionKey);
  if (new Set(keys).size !== keys.length) {
    ui.notify("File picker received duplicate result rows", "error");
    return false;
  }

  return true;
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

function getViewportStart(
  highlightedIndex: number,
  candidateCount: number,
  maxVisible: number,
): number {
  if (candidateCount <= maxVisible) return 0;

  const halfWindow = Math.floor(maxVisible / 2);
  const centeredStart = highlightedIndex - halfWindow;
  const maxStart = candidateCount - maxVisible;
  return Math.min(maxStart, Math.max(0, centeredStart));
}
