import type { Chapter, ChapterRow, ChapterSummary } from "../types";
import { getOwnedBook } from "./BookService";

export interface SaveChapterInput {
  title: string;
  content: string;
  hash?: string;
}

function toSummary(row: ChapterRow): ChapterSummary {
  return {
    id: row.id,
    bookId: row.book_id,
    title: row.title,
    sortOrder: row.sort_order,
    updateTime: row.update_time,
  };
}

function toChapter(row: ChapterRow): Chapter {
  return {
    ...toSummary(row),
    content: row.content,
    contentHash: row.content_hash,
    createTime: row.create_time,
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
  if (!row) throw new Error("章节不存在");

  const book = await getOwnedBook(env, userId, row.book_id);
  if (!book) throw new Error("无权操作");

  return row;
}

/** List chapters of a book the user owns (no content). */
export async function listChapters(
  env: Env,
  userId: number,
  bookId: number
): Promise<ChapterSummary[]> {
  const book = await getOwnedBook(env, userId, bookId);
  if (!book) throw new Error("无权操作");

  const { results } = await env.DB.prepare(
    `select * from t_chapter where book_id = ? order by sort_order asc, id asc`
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
  if (!book) throw new Error("无权操作");

  const row = await env.DB.prepare(
    `insert into t_chapter (book_id, title, sort_order)
     values (?, ?, (select coalesce(max(sort_order), 0) + 1 from t_chapter where book_id = ?))
     returning *`
  )
    .bind(bookId, title?.trim() || "未命名章节", bookId)
    .first<ChapterRow>();

  if (!row) throw new Error("创建章节失败");
  return toChapter(row);
}

/**
 * Save a chapter. If the provided hash matches the stored content_hash, the
 * write is skipped (idempotent). Verifies ownership first.
 */
export async function saveChapter(
  env: Env,
  userId: number,
  chapterId: number,
  input: SaveChapterInput
): Promise<Chapter> {
  const row = await getOwnedChapterRow(env, userId, chapterId);

  if (input.hash && row.content_hash && input.hash === row.content_hash) {
    return toChapter(row);
  }

  const updated = await env.DB.prepare(
    `update t_chapter
     set title = ?, content = ?, content_hash = ?, update_time = CURRENT_TIMESTAMP
     where id = ? returning *`
  )
    .bind(input.title, input.content, input.hash ?? null, chapterId)
    .first<ChapterRow>();

  if (!updated) throw new Error("保存章节失败");
  return toChapter(updated);
}

/**
 * Reorder the chapters of a book to match the given id sequence. Verifies the
 * user owns the book and that every id belongs to it, then writes each
 * chapter's sort_order to its index. Returns the reordered list.
 */
export async function reorderChapters(
  env: Env,
  userId: number,
  bookId: number,
  ids: number[]
): Promise<ChapterSummary[]> {
  const book = await getOwnedBook(env, userId, bookId);
  if (!book) throw new Error("无权操作");

  const { results } = await env.DB.prepare(
    `select id from t_chapter where book_id = ?`
  )
    .bind(bookId)
    .all<{ id: number }>();
  const owned = new Set(results.map((r) => r.id));

  for (const id of ids) {
    if (!owned.has(id)) throw new Error("章节不属于该书");
  }

  const statements = ids.map((id, index) =>
    env.DB.prepare(
      `update t_chapter set sort_order = ? where id = ? and book_id = ?`
    ).bind(index, id, bookId)
  );
  if (statements.length) await env.DB.batch(statements);

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
