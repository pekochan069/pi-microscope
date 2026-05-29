import type { FileItem, Result, Score, SearchResult as FffSearchResult } from "@ff-labs/fff-node";

import { FileFinder } from "@ff-labs/fff-node";

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_SCAN_TIMEOUT_MS = 2_000;

export interface FileCandidate {
  relativePath: string;
  fileName: string;
  gitStatus: string;
  size: number;
  score?: number;
}

export type FileSearchResult =
  | { status: "ok"; candidates: FileCandidate[] }
  | { status: "empty"; message: string }
  | { status: "error"; message: string };

export interface FinderService {
  search(query: string): Promise<FileSearchResult>;
  destroy(): void;
}

export interface NativeFinder {
  waitForScan(timeoutMs?: number): Promise<Result<boolean>>;
  fileSearch(query: string, options?: { pageSize?: number }): Result<FffSearchResult>;
  destroy(): void;
}

export interface NativeFinderAdapter {
  create(options: {
    basePath: string;
    aiMode: true;
    disableContentIndexing: true;
  }): Result<NativeFinder>;
}

const fffAdapter: NativeFinderAdapter = {
  create: (options) => FileFinder.create(options),
};

export class FffFinderService implements FinderService {
  private finder: NativeFinder | undefined;
  private destroyed = false;

  constructor(
    private readonly basePath: string,
    private readonly adapter: NativeFinderAdapter = fffAdapter,
    private readonly scanTimeoutMs = DEFAULT_SCAN_TIMEOUT_MS,
    private readonly pageSize = DEFAULT_PAGE_SIZE,
  ) {}

  async search(query: string): Promise<FileSearchResult> {
    if (this.destroyed) {
      return { status: "error", message: "File finder has been destroyed" };
    }

    const finderResult = await this.getFinder();
    if (finderResult.status === "error") return finderResult;

    await this.waitForScan(finderResult.finder);
    const search = finderResult.finder.fileSearch(query, { pageSize: this.pageSize });
    if (!search.ok) return { status: "error", message: search.error };

    const candidates = mapFileCandidates(search.value.items, search.value.scores);
    if (candidates.length === 0) {
      return { status: "empty", message: `No files matched "${query}"` };
    }

    return { status: "ok", candidates };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.finder?.destroy();
    this.finder = undefined;
  }

  private async getFinder(): Promise<
    { status: "ok"; finder: NativeFinder } | { status: "error"; message: string }
  > {
    if (this.finder) return { status: "ok", finder: this.finder };

    const created = this.adapter.create({
      basePath: this.basePath,
      aiMode: true,
      disableContentIndexing: true,
    });

    if (!created.ok) return { status: "error", message: created.error };
    this.finder = created.value;
    return { status: "ok", finder: created.value };
  }

  private async waitForScan(finder: NativeFinder): Promise<void> {
    try {
      await finder.waitForScan(this.scanTimeoutMs);
    } catch {
      // Search can still return partial/current index results after scan timeout/failure.
    }
  }
}

export function mapFileCandidates(items: FileItem[], scores: Score[] = []): FileCandidate[] {
  return items.map((item, index) => ({
    relativePath: item.relativePath,
    fileName: item.fileName,
    gitStatus: item.gitStatus,
    size: item.size,
    score: scores[index]?.total,
  }));
}
