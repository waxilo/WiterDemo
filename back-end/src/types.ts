// Shared domain types for the backend.

/** Row shape for t_book. */
export interface BookRow {
  id: number;
  user_id: number;
  title: string;
  sort_order: number;
  create_time: string;
  update_time: string;
}

/** Row shape for t_chapter. */
export interface ChapterRow {
  id: number;
  book_id: number;
  title: string;
  content: string;
  content_hash: string | null;
  sort_order: number;
  create_time: string;
  update_time: string;
}

/** Book list item / detail returned to the client (camelCase). */
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

/** Result of token verification. */
export interface TokenCheck {
  success: boolean;
  userId?: number;
}
