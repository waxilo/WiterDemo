import { login, register, refresh, logout } from "./controller/login";
import * as userController from "./controller/user";
import * as bookController from "./controller/book";
import * as chapterController from "./controller/chapter";
import { checkAuth } from "./middleware/auth";
import { jsonResponse } from "./response";
import type { Ctx } from "./context";

const ID_SEGMENT = /^\d+$/;

/**
 * Dispatch a request to the matching controller.
 *
 * Route-shape validation happens BEFORE auth, so an unknown path is a 404 for
 * everyone (previously an unauthenticated request to an unknown path got 401,
 * and `/books/abc` leaked a 500). `ctx.params` only ever receives validated
 * positive-integer ids.
 */
export async function router(ctx: Ctx): Promise<Response> {
  const { method } = ctx;
  const segments = ctx.url.pathname.split("/").filter(Boolean);
  const seg = (i: number): string | undefined => segments[i];

  // Login and register are public.
  if (method === "POST" && segments.length === 1 && seg(0) === "login") {
    return login(ctx);
  }
  if (
    method === "POST" &&
    segments.length === 1 &&
    seg(0) === "register"
  ) {
    return register(ctx);
  }
  if (method === "POST" && segments.length === 1 && seg(0) === "refresh") {
    return refresh(ctx);
  }
  if (method === "POST" && segments.length === 1 && seg(0) === "logout") {
    return logout(ctx);
  }

  // --- protected routes: shape check first (404 beats 401) ------------------

  const bookId = seg(1);
  const chapterId = seg(1);
  const isMe = segments.length === 1 && seg(0) === "me";
  const isBooks = segments.length === 1 && seg(0) === "books";
  const isBookId =
    segments.length === 2 &&
    seg(0) === "books" &&
    bookId !== undefined &&
    ID_SEGMENT.test(bookId);
  const isBookChapters =
    segments.length === 3 &&
    seg(0) === "books" &&
    bookId !== undefined &&
    ID_SEGMENT.test(bookId) &&
    seg(2) === "chapters";
  const isChapterId =
    segments.length === 2 &&
    seg(0) === "chapters" &&
    chapterId !== undefined &&
    ID_SEGMENT.test(chapterId);

  if (!isMe && !isBooks && !isBookId && !isBookChapters && !isChapterId) {
    return jsonResponse(null, 404, "Not Found API");
  }

  const auth = await checkAuth(ctx);
  if (!auth.success) {
    return jsonResponse(null, 401, auth.message ?? "未登录");
  }
  ctx.userId = auth.userId!;

  // /me — current user info
  if (isMe) {
    if (method === "GET") return userController.me(ctx);
    return jsonResponse(null, 404, "Not Found API");
  }

  // /books
  if (isBooks) {
    if (method === "GET") return bookController.listBooks(ctx);
    if (method === "POST") return bookController.createBook(ctx);
    return jsonResponse(null, 404, "Not Found API");
  }

  // /books/:id
  if (isBookId && bookId !== undefined) {
    ctx.params.id = bookId;
    if (method === "PUT") return bookController.renameBook(ctx);
    if (method === "DELETE") return bookController.deleteBook(ctx);
    return jsonResponse(null, 404, "Not Found API");
  }

  // /books/:bookId/chapters
  if (isBookChapters && bookId !== undefined) {
    ctx.params.bookId = bookId;
    if (method === "GET") return chapterController.listChapters(ctx);
    if (method === "POST") return chapterController.createChapter(ctx);
    if (method === "PUT") return chapterController.reorderChapters(ctx);
    return jsonResponse(null, 404, "Not Found API");
  }

  // /chapters/:id
  if (isChapterId && chapterId !== undefined) {
    ctx.params.id = chapterId;
    if (method === "GET") return chapterController.getChapter(ctx);
    if (method === "PUT") return chapterController.saveChapter(ctx);
    if (method === "DELETE") return chapterController.deleteChapter(ctx);
    return jsonResponse(null, 404, "Not Found API");
  }

  return jsonResponse(null, 404, "Not Found API");
}
