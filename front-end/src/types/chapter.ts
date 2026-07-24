/** A book (writing project) belonging to the user. */
export interface Book {
  id: number;
  title: string;
  sortOrder: number;
  updateTime: string;
  /** Number of chapters (optional: older API responses may omit it). */
  chapterCount?: number;
  /** Total character count across chapters (optional). */
  wordCount?: number;
}

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
}

/** Chapter detail (with content). */
export interface Chapter extends ChapterSummary {
  content: string;
  contentHash: string | null;
  createTime: string;
}

/** Payload for saving a chapter. */
export interface SaveChapterPayload {
  title: string;
  content: string;
  hash: string;
}
