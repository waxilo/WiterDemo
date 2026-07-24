/** A book (writing project) belonging to the user. */
export interface Book {
  id: number;
  title: string;
  sortOrder: number;
  updateTime: string;
}

/** Chapter list item (no content). */
export interface ChapterSummary {
  id: number;
  bookId: number;
  title: string;
  sortOrder: number;
  updateTime: string;
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
