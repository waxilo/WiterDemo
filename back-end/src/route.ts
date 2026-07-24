import { login, register, refresh, logout } from "./controller/login";
import * as userController from "./controller/user";
import * as bookController from "./controller/book";
import * as chapterController from "./controller/chapter";
import { checkAuth } from "./middleware/auth";
import { jsonResponse } from "./response";
import type { Ctx } from "./context";

/** Dispatch a request to the matching controller. */
export async function router(ctx: Ctx): Promise<Response> {
  const { method } = ctx;
  const segments = ctx.url.pathname.split("/").filter(Boolean);

  // Login and register are public.
  if (method === "POST" && segments.length === 1 && segments[0] === "login") {
    return login(ctx);
  }
  if (
    method === "POST" &&
    segments.length === 1 &&
    segments[0] === "register"
  ) {
    return register(ctx);
  }
  if (method === "POST" && segments.length === 1 && segments[0] === "refresh") {
    return refresh(ctx);
  }
  if (method === "POST" && segments.length === 1 && segments[0] === "logout") {
    return logout(ctx);
  }

  // Everything else requires a valid token.
  const auth = await checkAuth(ctx);
  if (!auth.success) {
    return jsonResponse(null, 401, auth.message ?? "未登录");
  }
  ctx.userId = auth.userId!;

  // /me — current user info
  if (method === "GET" && segments.length === 1 && segments[0] === "me") {
    return userController.me(ctx);
  }

  // /books
  if (segments.length === 1 && segments[0] === "books") {
    if (method === "GET") return bookController.listBooks(ctx);
    if (method === "POST") return bookController.createBook(ctx);
  }

  // /books/:id
  if (segments.length === 2 && segments[0] === "books") {
    ctx.params.id = segments[1];
    if (method === "PUT") return bookController.renameBook(ctx);
    if (method === "DELETE") return bookController.deleteBook(ctx);
  }

  // /books/:bookId/chapters
  if (
    segments.length === 3 &&
    segments[0] === "books" &&
    segments[2] === "chapters"
  ) {
    ctx.params.bookId = segments[1];
    if (method === "GET") return chapterController.listChapters(ctx);
    if (method === "POST") return chapterController.createChapter(ctx);
    if (method === "PUT") return chapterController.reorderChapters(ctx);
  }

  // /chapters/:id
  if (segments.length === 2 && segments[0] === "chapters") {
    ctx.params.id = segments[1];
    if (method === "GET") return chapterController.getChapter(ctx);
    if (method === "PUT") return chapterController.saveChapter(ctx);
    if (method === "DELETE") return chapterController.deleteChapter(ctx);
  }

  return jsonResponse(null, 404, "Not Found API");
}
