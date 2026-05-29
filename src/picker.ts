import type { Component, KeyId, TUI } from "@earendil-works/pi-tui";

import { matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

import type { MicroscopeKeys, MicroscopeOptions } from "./config.ts";
import type { FileCandidate, FileSearchResult } from "./finder.ts";
import type { PreviewResult } from "./preview.ts";

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

export type PickerMode = "project-files" | "git-changed";

export const PICKER_MODE_LABELS: Record<PickerMode, string> = {
  "project-files": "Project files",
  "git-changed": "Git changed",
};

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

export function toggleHighlightedCandidate(
  state: PickerState,
  candidates: FileCandidate[],
): PickerState {
  const candidate = candidates[state.highlightedIndex];
  if (!candidate) return state;

  const selectedPaths = new Set(state.selectedPaths);
  if (selectedPaths.has(candidate.relativePath)) {
    selectedPaths.delete(candidate.relativePath);
  } else {
    selectedPaths.add(candidate.relativePath);
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
    return candidates.filter((candidate) => state.selectedPaths.has(candidate.relativePath));
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
    const marker = state.selectedPaths.has(candidate.relativePath) ? "[x]" : "[ ]";
    const status = formatCandidateStatus(candidate);
    const row = `${pointer} ${marker} ${status}${candidate.relativePath}${formatRename(candidate)}`;
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
    private readonly query: string,
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
    }
  }

  invalidate(): void {}

  render(width: number): string[] {
    const safeWidth = Math.max(20, width);
    const header = `${PICKER_MODE_LABELS[this.state.mode]} • Query: ${this.query || "∅"} • Selected: ${getSelectedCount(this.state)}`;
    const rows =
      this.candidates.length > 0
        ? renderCandidateRows(this.candidates, this.state, safeWidth, 12)
        : [truncateToWidth(this.message || "No files", safeWidth)];
    const preview = this.renderPreview(safeWidth);
    const footer = `${this.options.keys.projectMode[0]} project • ${this.options.keys.gitChangedMode[0]} git • ↑↓/Ctrl-N/P move • Space select • Enter insert • Esc cancel`;

    return [
      truncateToWidth(header, safeWidth),
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

    const requestId = ++this.requestId;
    this.state = switchPickerMode(this.state, mode);
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

  private renderPreview(width: number): string[] {
    const candidate = this.candidates[this.state.highlightedIndex];
    if (!candidate || !this.options.preview) return [truncateToWidth("Preview unavailable", width)];

    const result = this.options.preview(candidate);
    if (result.status === "unavailable") return [truncateToWidth(result.message, width)];

    const lines = result.lines.slice(0, 6).map((line, index) => {
      const numbered = `${String(index + 1).padStart(3, " ")}  ${line}`;
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
  };
}

function validateCandidates(ui: PickerUI, candidates: FileCandidate[]): boolean {
  const paths = candidates.map((candidate) => candidate.relativePath);
  if (new Set(paths).size !== paths.length) {
    ui.notify("File picker received duplicate paths", "error");
    return false;
  }

  return true;
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

function formatRename(candidate: FileCandidate): string {
  return candidate.originalPath ? ` ← ${candidate.originalPath}` : "";
}

function matchesAny(data: string, keys: KeyId[]): boolean {
  return keys.some((key) => matchesKey(data, key));
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
