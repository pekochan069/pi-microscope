import type { FileCandidate } from "./finder.ts";

import { normalizePathReference } from "./editor.ts";

export interface ContextBudgetOptions {
  maxTokens: number;
}

export interface CandidateContextEstimate {
  bytes: number;
  approxTokens: number;
}

export interface SelectedContextBudgetSummary extends CandidateContextEstimate {
  fileCount: number;
  unknownFileCount: number;
}

export interface ContextBudgetSummary {
  selected: SelectedContextBudgetSummary;
  highlighted: CandidateContextEstimate | undefined;
  maxTokens: number;
  isOverBudget: boolean;
}

export function dedupeCandidatesByRelativePath(candidates: FileCandidate[]): FileCandidate[] {
  const seen = new Set<string>();
  const deduped: FileCandidate[] = [];

  for (const candidate of candidates) {
    const key = normalizePathReference(candidate.relativePath);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
}

export function byteCountToApproxTokens(bytes: number): number {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  return Math.ceil(bytes / 4);
}

export function createContextBudgetSummary(input: {
  selectedCandidates: FileCandidate[];
  highlightedCandidate?: FileCandidate;
  maxTokens: number;
}): ContextBudgetSummary {
  const selectedCandidates = dedupeCandidatesByRelativePath(input.selectedCandidates);
  let bytes = 0;
  let unknownFileCount = 0;

  for (const candidate of selectedCandidates) {
    const estimate = estimateCandidateContext(candidate);
    if (!estimate) {
      unknownFileCount++;
      continue;
    }
    bytes += estimate.bytes;
  }

  const selected = {
    fileCount: selectedCandidates.length,
    bytes,
    approxTokens: byteCountToApproxTokens(bytes),
    unknownFileCount,
  };

  return {
    selected,
    highlighted: input.highlightedCandidate
      ? estimateCandidateContext(input.highlightedCandidate)
      : undefined,
    maxTokens: input.maxTokens,
    isOverBudget: selected.approxTokens > input.maxTokens,
  };
}

export function estimateCandidateContext(
  candidate: FileCandidate,
): CandidateContextEstimate | undefined {
  if (candidate.readable === false) return undefined;
  if (!Number.isFinite(candidate.size) || candidate.size < 0) return undefined;

  return {
    bytes: candidate.size,
    approxTokens: byteCountToApproxTokens(candidate.size),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatOneDecimal(bytes / 1024)} KB`;
  return `${formatOneDecimal(bytes / (1024 * 1024))} MB`;
}

export function formatApproxTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens} tokens`;
  return `${formatOneDecimal(tokens / 1000)}k tokens`;
}

function formatOneDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
