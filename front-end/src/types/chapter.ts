/** Chapter list item (no content). */
export interface ChapterSummary {
  id: number;
  bookId: number;
  title: string;
  sortOrder: number;
  updateTime: string;
  /** Chinese character count (optional for compatibility with older APIs). */
  wordCount?: number;
  /** Visible character count including punctuation. */
  charCount?: number;
  /** Optimistic-lock counter (used by the multi-device sync poller). */
  version?: number;
}

/** Chapter detail (with content). */
export interface Chapter extends ChapterSummary {
  content: string;
  contentHash: string | null;
  createTime: string;
  /** Optimistic-lock counter, bumped on every server save. */
  version: number;
}

/**
 * Payload for saving a chapter. `baseVersion` is the version the client
 * loaded; the server conditions the write on it and refuses (409) if it no
 * longer matches, so two windows editing the same chapter cannot silently
 * overwrite each other.
 */
export interface SaveChapterPayload {
  title: string;
  content: string;
  baseVersion: number;
}
