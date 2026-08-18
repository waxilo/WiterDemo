import type { Chapter, ChapterRow, ChapterSummary } from "../types";
import { getOwnedBook } from "./BookService";
import { ApiError } from "../errors";
import { sha256Hex } from "../utils/token";

export interface SaveChapterInput {
  title: string;
  content: string;
  /**
   * The `version` the client loaded. The write itself is conditioned on it
   * (`WHERE version = ?`), so concurrent saves are serialized atomically:
   * exactly one succeeds, the loser gets 409. Prefer this over baseUpdateTime
   * (second-precision timestamps let same-second saves slip through).
   */
  baseVersion?: number;
  /** Legacy lock (kept for compatibility); version takes precedence. */
  baseUpdateTime?: string;
}

const CJK_CHARACTER_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
const WHITESPACE_PATTERN = /\s/u;

function getContentStats(content: string): {
  wordCount: number;
  charCount: number;
} {
  return {
    wordCount: content.match(CJK_CHARACTER_PATTERN)?.length ?? 0,
    charCount: Array.from(content).filter(
      (character) => !WHITESPACE_PATTERN.test(character)
    ).length,
  };
}

function toSummary(row: ChapterRow): ChapterSummary {
  return {
    id: row.id,
    bookId: row.book_id,
    title: row.title,
    sortOrder: row.sort_order,
    updateTime: row.update_time,
    wordCount: row.word_count ?? 0,
    charCount: row.char_count ?? 0,
    version: row.version,
  };
}

function toChapter(row: ChapterRow): Chapter {
  return {
    ...toSummary(row),
    content: row.content,
    contentHash: row.content_hash,
    createTime: row.create_time,
    version: row.version,
  };
}

/** Load a chapter row and verify the current user owns its book. */
async function getOwnedChapterRow(
  env: Env,
  userId: number,
  chapterId: number
): Promise<ChapterRow> {
  const row = await env.DB.prepare(`select * from t_chapter where id = ?`)
    .bind(chapterId)
    .first<ChapterRow>();
  if (!row) throw new ApiError(404, "章节不存在");

  const book = await getOwnedBook(env, userId, row.book_id);
  if (!book) throw new ApiError(403, "无权操作");

  return row;
}

/** List chapters of a book the user owns (metadata only, no content). */
export async function listChapters(
  env: Env,
  userId: number,
  bookId: number
): Promise<ChapterSummary[]> {
  const book = await getOwnedBook(env, userId, bookId);
  if (!book) throw new ApiError(403, "无权操作");

  const { results } = await env.DB.prepare(
    `select id, book_id, title, sort_order, update_time, word_count, char_count, version
     from t_chapter where book_id = ? order by sort_order asc, id asc`
  )
    .bind(bookId)
    .all<ChapterRow>();
  return results.map(toSummary);
}

/** Get a single chapter with content. */
export async function getChapter(
  env: Env,
  userId: number,
  chapterId: number
): Promise<Chapter> {
  const row = await getOwnedChapterRow(env, userId, chapterId);
  return toChapter(row);
}

/** Create a chapter under a book the user owns. */
export async function createChapter(
  env: Env,
  userId: number,
  bookId: number,
  title?: string
): Promise<Chapter> {
  const book = await getOwnedBook(env, userId, bookId);
  if (!book) throw new ApiError(403, "无权操作");

  const row = await env.DB.prepare(
    `insert into t_chapter (book_id, title, sort_order, word_count, char_count)
     values (?, ?, (select coalesce(max(sort_order), 0) + 1 from t_chapter where book_id = ?), 0, 0)
     returning *`
  )
    .bind(bookId, title?.trim() || "未命名章节", bookId)
    .first<ChapterRow>();

  if (!row) throw new ApiError(500, "创建章节失败");
  return toChapter(row);
}

/**
 * Save a chapter with optimistic concurrency control: the UPDATE itself is
 * conditioned on the version the client loaded (`WHERE version = ?`), so two
 * concurrent saves are serialized atomically — the loser matches zero rows and
 * gets 409. Without baseVersion we fall back to the legacy update_time check.
 * The content hash is computed server-side; stats are denormalized into the
 * row.
 */
export async function saveChapter(
  env: Env,
  userId: number,
  chapterId: number,
  input: SaveChapterInput
): Promise<Chapter> {
  const row = await getOwnedChapterRow(env, userId, chapterId);

  const stats = getContentStats(input.content);
  const contentHash = await sha256Hex(input.content);

  const useVersion =
    typeof input.baseVersion === "number" && Number.isSafeInteger(input.baseVersion);
  const versionGuard = useVersion ? " and version = ?" : "";
  const args: unknown[] = [
    input.title.trim() || "未命名章节",
    input.content,
    contentHash,
    stats.wordCount,
    stats.charCount,
    chapterId,
  ];
  if (useVersion) args.push(input.baseVersion);

  const updated = await env.DB.prepare(
    `update t_chapter
     set title = ?, content = ?, content_hash = ?, word_count = ?, char_count = ?,
         version = version + 1, update_time = CURRENT_TIMESTAMP
     where id = ?${versionGuard} returning *`
  )
    .bind(...args)
    .first<ChapterRow>();

  if (!updated) {
    if (useVersion) {
      // Zero rows matched: another device saved in between -> conflict. The
      // payload carries the server's current state so the client can align
      // its base version without an extra round-trip (or fetching content).
      throw new ApiError(409, "章节已在其他设备被修改，已自动重试保存", {
        version: row.version,
        updateTime: row.update_time,
      });
    }
    // Legacy path: pre-check update_time (best effort, second precision).
    if (
      input.baseUpdateTime !== undefined &&
      row.update_time !== input.baseUpdateTime
    ) {
      throw new ApiError(409, "章节已在其他设备被修改，已自动重试保存", {
        version: row.version,
        updateTime: row.update_time,
      });
    }
    throw new ApiError(500, "保存章节失败");
  }
  return toChapter(updated);
}

/**
 * Reorder the chapters of a book to match the given id sequence. Verifies the
 * user owns the book, that the sequence covers exactly the book's chapters
 * (no duplicates, no omissions), then writes each chapter's sort_order to its
 * index. D1 batches are limited to 100 statements, so large books are written
 * in chunks (each chunk is its own transaction; a crash mid-way leaves a
 * partially reordered list, which the next successful reorder heals).
 */
export async function reorderChapters(
  env: Env,
  userId: number,
  bookId: number,
  ids: number[]
): Promise<ChapterSummary[]> {
  const book = await getOwnedBook(env, userId, bookId);
  if (!book) throw new ApiError(403, "无权操作");

  const { results } = await env.DB.prepare(
    `select id from t_chapter where book_id = ?`
  )
    .bind(bookId)
    .all<{ id: number }>();
  const owned = new Set(results.map((r) => r.id));

  if (new Set(ids).size !== ids.length || ids.length !== owned.size) {
    throw new ApiError(400, "排序列表不合法");
  }
  for (const id of ids) {
    if (!owned.has(id)) throw new ApiError(400, "章节不属于该书");
  }

  const statements = ids.map((id, index) =>
    env.DB.prepare(
      `update t_chapter set sort_order = ? where id = ? and book_id = ?`
    ).bind(index, id, bookId)
  );
  const BATCH_LIMIT = 100; // D1 hard cap per batch call
  for (let i = 0; i < statements.length; i += BATCH_LIMIT) {
    await env.DB.batch(statements.slice(i, i + BATCH_LIMIT));
  }

  return listChapters(env, userId, bookId);
}

/** Delete a chapter the user owns. */
export async function deleteChapter(
  env: Env,
  userId: number,
  chapterId: number
): Promise<{ id: number }> {
  await getOwnedChapterRow(env, userId, chapterId);
  await env.DB.prepare(`delete from t_chapter where id = ?`)
    .bind(chapterId)
    .run();
  return { id: chapterId };
}
