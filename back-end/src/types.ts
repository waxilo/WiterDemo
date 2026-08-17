// Shared domain types for the backend.

/** Row shape for t_book. */
export interface BookRow {
  id: number;
  user_id: number;
  title: string;
  sort_order: number;
  create_time: string;
  update_time: string;
  /** Aggregates, present only on the list query. */
  chapter_count?: number;
  word_count?: number;
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
  /** Denormalized stats (written on save; 0 for pre-migration rows). */
  word_count: number;
  char_count: number;
  /** Optimistic-lock counter, bumped on every save. */
  version: number;
}

/** Book list item / detail returned to the client (camelCase). */
export interface Book {
  id: number;
  title: string;
  sortOrder: number;
  updateTime: string;
  /** Number of chapters in the book. */
  chapterCount: number;
  /** Total character count across all chapters. */
  wordCount: number;
}

/** Chapter list item (no content). */
export interface ChapterSummary {
  id: number;
  bookId: number;
  title: string;
  sortOrder: number;
  updateTime: string;
  /** Chinese character count. */
  wordCount: number;
  /** Visible character count, including punctuation. */
  charCount: number;
}

/** Chapter detail (with content). */
export interface Chapter extends ChapterSummary {
  content: string;
  contentHash: string | null;
  createTime: string;
  /** Optimistic-lock counter; pass back as baseVersion when saving. */
  version: number;
}

/** Result of token verification. */
export interface TokenCheck {
  success: boolean;
  userId?: number;
}

/** Row shape for t_user. */
export interface UserRow {
  id: number;
  username: string;
  password: string;
  nickname: string | null;
  avatar: string | null;
  create_time: string;
  update_time: string;
}

/** Current user info returned to the client (no password). */
export interface UserInfo {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
}
