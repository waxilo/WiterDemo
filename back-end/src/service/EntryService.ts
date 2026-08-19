// Setting library (设定资料库): generic entries for characters / locations /
// concepts, grouped per book.

import type { Entry, EntryRow } from "../types";
import { getOwnedBook } from "./BookService";
import { ApiError } from "../errors";

export const ENTRY_TYPES = ["character", "location", "concept"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    bookId: row.book_id,
    type: row.type,
    title: row.title,
    content: row.content,
    sortOrder: row.sort_order,
    updateTime: row.update_time,
  };
}

function assertType(type: string): EntryType {
  if (!ENTRY_TYPES.includes(type as EntryType)) {
    throw new ApiError(400, "条目类型不合法");
  }
  return type as EntryType;
}

/** List entries of a book, optionally filtered by type. */
export async function listEntries(
  env: Env,
  userId: number,
  bookId: number,
  type?: string
): Promise<Entry[]> {
  const book = await getOwnedBook(env, userId, bookId);
  if (!book) throw new ApiError(403, "无权操作");

  const filter = type !== undefined ? " and type = ?" : "";
  const { results } = await env.DB.prepare(
    `select * from t_entry where book_id = ?${filter} order by sort_order asc, id asc`
  )
    .bind(...(type !== undefined ? [bookId, type] : [bookId]))
    .all<EntryRow>();
  return results.map(toEntry);
}

/** Create an entry. */
export async function createEntry(
  env: Env,
  userId: number,
  bookId: number,
  type: string,
  title?: string
): Promise<Entry> {
  const book = await getOwnedBook(env, userId, bookId);
  if (!book) throw new ApiError(403, "无权操作");
  const entryType = assertType(type);

  const row = await env.DB.prepare(
    `insert into t_entry (book_id, type, title, sort_order)
     values (?, ?, ?, (select coalesce(max(sort_order), 0) + 1 from t_entry where book_id = ?))
     returning *`
  )
    .bind(bookId, entryType, title?.trim() || "未命名条目", bookId)
    .first<EntryRow>();
  if (!row) throw new ApiError(500, "创建条目失败");
  return toEntry(row);
}

/** Load a single entry with ownership check. */
export async function getEntry(
  env: Env,
  userId: number,
  entryId: number
): Promise<Entry> {
  const row = await env.DB.prepare(`select * from t_entry where id = ?`)
    .bind(entryId)
    .first<EntryRow>();
  if (!row) throw new ApiError(404, "条目不存在");
  const book = await getOwnedBook(env, userId, row.book_id);
  if (!book) throw new ApiError(403, "无权操作");
  return toEntry(row);
}

/** Update an entry (title / content / type). */
export async function updateEntry(
  env: Env,
  userId: number,
  entryId: number,
  patch: { title?: string; content?: string; type?: string }
): Promise<Entry> {
  const current = await getEntry(env, userId, entryId);

  const nextTitle = patch.title?.trim() || current.title;
  const nextType = patch.type !== undefined ? assertType(patch.type) : current.type;
  const nextContent = patch.content ?? current.content;

  const row = await env.DB.prepare(
    `update t_entry set title = ?, content = ?, type = ?, update_time = CURRENT_TIMESTAMP
     where id = ? returning *`
  )
    .bind(nextTitle, nextContent, nextType, entryId)
    .first<EntryRow>();
  if (!row) throw new ApiError(500, "更新条目失败");
  return toEntry(row);
}

/** Delete an entry. */
export async function deleteEntry(
  env: Env,
  userId: number,
  entryId: number
): Promise<{ id: number }> {
  await getEntry(env, userId, entryId);
  await env.DB.prepare(`delete from t_entry where id = ?`).bind(entryId).run();
  return { id: entryId };
}
