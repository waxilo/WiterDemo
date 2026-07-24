import { request } from "./http";
import type { Chapter, ChapterSummary, SaveChapterPayload } from "../types/chapter";

/** List chapters of a book (no content). */
export function listChapters(bookId: number): Promise<ChapterSummary[]> {
  return request<ChapterSummary[]>(`/books/${bookId}/chapters`, {
    method: "GET",
  });
}

/** Create a chapter under a book. */
export function createChapter(bookId: number, title?: string): Promise<Chapter> {
  return request<Chapter>(`/books/${bookId}/chapters`, {
    method: "POST",
    body: { title },
  });
}

/** Get a chapter with its content. */
export function getChapter(id: number): Promise<Chapter> {
  return request<Chapter>(`/chapters/${id}`, { method: "GET" });
}

/** Save a chapter (Ctrl+S / autosave). */
export function saveChapter(
  id: number,
  payload: SaveChapterPayload
): Promise<Chapter> {
  return request<Chapter>(`/chapters/${id}`, { method: "PUT", body: payload });
}

/** Delete a chapter. */
export function deleteChapter(id: number): Promise<{ id: number }> {
  return request<{ id: number }>(`/chapters/${id}`, { method: "DELETE" });
}
