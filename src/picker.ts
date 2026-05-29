import type { Component } from "@earendil-works/pi-tui";

import { Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

import type { FileCandidate } from "./finder.ts";

interface CustomPickerOptions {
  overlay: boolean;
  overlayOptions?: {
    width?: number | `${number}%`;
    maxHeight?: number | `${number}%`;
  };
}

type CustomPickerFactory<T> = (
  tui: unknown,
  theme: unknown,
  keybindings: unknown,
  done: (value: T) => void,
) => Component;

export interface PickerUI {
  custom?<T>(factory: CustomPickerFactory<T>, options: CustomPickerOptions): Promise<T>;
  notify(message: string, type?: "info" | "warning" | "error"): void;
}

export interface PickerState {
  highlightedIndex: number;
  selectedPaths: Set<string>;
}

export function createPickerState(): PickerState {
  return { highlightedIndex: 0, selectedPaths: new Set() };
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
    const row = `${pointer} ${marker} ${candidate.relativePath}`;
    return truncateToWidth(row, width);
  });
}

export async function pickFiles(
  ui: PickerUI,
  candidates: FileCandidate[],
  query = "",
): Promise<FileCandidate[] | undefined> {
  if (!validateCandidates(ui, candidates, query)) return undefined;

  if (!ui.custom) {
    ui.notify("Multi-select file picker requires custom UI", "error");
    return undefined;
  }

  const title = query ? `Select files for "${query}"` : "Select files";
  return ui.custom<FileCandidate[] | undefined>(
    (_tui, _theme, _keybindings, done) => new MultiSelectPickerComponent(title, candidates, done),
    {
      overlay: true,
      overlayOptions: { width: "80%", maxHeight: "80%" },
    },
  );
}

export class MultiSelectPickerComponent implements Component {
  private state = createPickerState();

  constructor(
    private readonly title: string,
    private readonly candidates: FileCandidate[],
    private readonly done: (value: FileCandidate[] | undefined) => void,
  ) {}

  handleInput(data: string): void {
    if (matchesKey(data, Key.up) || matchesKey(data, Key.ctrl("p"))) {
      this.state = moveHighlight(this.state, this.candidates, -1);
      return;
    }

    if (matchesKey(data, Key.down) || matchesKey(data, Key.ctrl("n"))) {
      this.state = moveHighlight(this.state, this.candidates, 1);
      return;
    }

    if (matchesKey(data, Key.space)) {
      this.state = toggleHighlightedCandidate(this.state, this.candidates);
      return;
    }

    if (matchesKey(data, Key.enter)) {
      this.done(confirmPickerSelection(this.state, this.candidates));
      return;
    }

    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.done(undefined);
    }
  }

  invalidate(): void {}

  render(width: number): string[] {
    const safeWidth = Math.max(20, width);
    const header = `${this.title} • Selected: ${getSelectedCount(this.state)}`;
    const rows = renderCandidateRows(this.candidates, this.state, safeWidth, 12);
    const footer = "↑↓/Ctrl-N/P move • Space select/unselect • Enter insert • Esc cancel";

    return [
      truncateToWidth(header, safeWidth),
      "─".repeat(Math.min(safeWidth, 80)),
      ...rows,
      "─".repeat(Math.min(safeWidth, 80)),
      truncateToWidth(footer, safeWidth),
    ];
  }
}

function validateCandidates(ui: PickerUI, candidates: FileCandidate[], query: string): boolean {
  if (candidates.length === 0) {
    ui.notify(`No files matched "${query}"`, "warning");
    return false;
  }

  const paths = candidates.map((candidate) => candidate.relativePath);
  if (new Set(paths).size !== paths.length) {
    ui.notify("File picker received duplicate paths", "error");
    return false;
  }

  return true;
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
