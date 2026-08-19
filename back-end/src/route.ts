import { login, register, refresh, logout } from "./controller/login";
import * as userController from "./controller/user";
import * as bookController from "./controller/book";
import * as chapterController from "./controller/chapter";
import * as sessionService from "./service/SessionService";
import * as writerController from "./controller/writer";
import * as entryController from "./controller/entry";
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
  const isMePassword =
    segments.length === 2 && seg(0) === "me" && seg(1) === "password";
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
  const isBookSearch =
    segments.length === 3 &&
    seg(0) === "books" &&
    bookId !== undefined &&
    ID_SEGMENT.test(bookId) &&
    seg(2) === "search";
  const isBookReplace =
    segments.length === 3 &&
    seg(0) === "books" &&
    bookId !== undefined &&
    ID_SEGMENT.test(bookId) &&
    seg(2) === "replace";
  const isBookOutline =
    segments.length === 3 &&
    seg(0) === "books" &&
    bookId !== undefined &&
    ID_SEGMENT.test(bookId) &&
    seg(2) === "outline";
  const isBookVolumes =
    segments.length === 3 &&
    seg(0) === "books" &&
    bookId !== undefined &&
    ID_SEGMENT.test(bookId) &&
    seg(2) === "volumes";
  const isBookEntries =
    segments.length === 3 &&
    seg(0) === "books" &&
    bookId !== undefined &&
    ID_SEGMENT.test(bookId) &&
    seg(2) === "entries";
  const isVolumeId =
    segments.length === 2 &&
    seg(0) === "volumes" &&
    chapterId !== undefined &&
    ID_SEGMENT.test(chapterId);
  const isEntryId =
    segments.length === 2 &&
    seg(0) === "entries" &&
    chapterId !== undefined &&
    ID_SEGMENT.test(chapterId);
  const isChapterVolume =
    segments.length === 3 &&
    seg(0) === "chapters" &&
    chapterId !== undefined &&
    ID_SEGMENT.test(chapterId) &&
    seg(2) === "volume";
  const isChapterHistory =
    segments.length === 3 &&
    seg(0) === "chapters" &&
    chapterId !== undefined &&
    ID_SEGMENT.test(chapterId) &&
    seg(2) === "history";
  const isChapterHistoryItem =
    segments.length === 4 &&
    seg(0) === "chapters" &&
    chapterId !== undefined &&
    ID_SEGMENT.test(chapterId) &&
    seg(2) === "history" &&
    seg(3) !== undefined &&
    ID_SEGMENT.test(seg(3)!);
  const isStatsCalendar =
    segments.length === 2 && seg(0) === "stats" && seg(1) === "calendar";
  const isChapterId =
    segments.length === 2 &&
    seg(0) === "chapters" &&
    chapterId !== undefined &&
    ID_SEGMENT.test(chapterId);

  if (
    !isMe && !isMePassword && !isBooks && !isBookId && !isBookChapters &&
    !isBookSearch && !isBookReplace && !isBookOutline && !isBookVolumes &&
    !isBookEntries && !isVolumeId && !isEntryId && !isChapterId &&
    !isChapterVolume && !isChapterHistory && !isChapterHistoryItem &&
    !isStatsCalendar
  ) {
    return jsonResponse(null, 404, "Not Found API");
  }

  const auth = await checkAuth(ctx);
  if (!auth.success) {
    return jsonResponse(null, 401, auth.message ?? "未登录");
  }
  ctx.userId = auth.userId!;
  ctx.userSid = auth.sid;

  /**
   * Single-active-session policy. Two layers:
   *
   * 1. PRE-CHECK (below): a write whose session was already revoked (kicked
   *    by another device, or rotated away by its own token refresh) is
   *    rejected with 401 BEFORE touching data. This also protects against the
   *    stale-AT race: an in-flight request using a pre-refresh access token
   *    (sid = old session) cannot accidentally kick the fresh session.
   * 2. POST-WRITE (afterWrite): after any successful write, every OTHER
   *    session of the account is revoked.
   */
  const isWrite = method === "POST" || method === "PUT" || method === "DELETE";
  if (isWrite && ctx.userSid !== undefined) {
    const mine = await sessionService.findSession(
      ctx.env,
      ctx.userId,
      ctx.userSid
    );
    if (!mine || mine.revoked === 1) {
      return jsonResponse(null, 401, "账号已在其他设备使用，请重新登录");
    }
  }

  /** Kick all other sessions after a successful write; never fails the request. */
  const afterWrite = async (res: Promise<Response> | Response): Promise<Response> => {
    const response = await res;
    if (
      response.status < 400 &&
      response.status !== 204 &&
      ctx.userSid !== undefined
    ) {
      // Best effort: a failed kick must not turn a successful write into 500.
      await sessionService
        .revokeAllExcept(ctx.env, ctx.userId, ctx.userSid)
        .catch(() => undefined);
    }
    return response;
  };

  // /me — current user info; /me/password — change password
  if (isMe || isMePassword) {
    if (isMe && method === "GET") return userController.me(ctx);
    if (isMePassword && method === "PUT") {
      return afterWrite(userController.changePassword(ctx));
    }
    return jsonResponse(null, 404, "Not Found API");
  }

  // /books
  if (isBooks) {
    if (method === "GET") return bookController.listBooks(ctx);
    if (method === "POST") return afterWrite(bookController.createBook(ctx));
    return jsonResponse(null, 404, "Not Found API");
  }

  // /books/:id
  if (isBookId && bookId !== undefined) {
    ctx.params.id = bookId;
    if (method === "PUT") return afterWrite(bookController.renameBook(ctx));
    if (method === "DELETE") return afterWrite(bookController.deleteBook(ctx));
    return jsonResponse(null, 404, "Not Found API");
  }

  // /books/:bookId/chapters
  if (isBookChapters && bookId !== undefined) {
    ctx.params.bookId = bookId;
    if (method === "GET") return chapterController.listChapters(ctx);
    if (method === "POST") return afterWrite(chapterController.createChapter(ctx));
    if (method === "PUT") return afterWrite(chapterController.reorderChapters(ctx));
    return jsonResponse(null, 404, "Not Found API");
  }

  // /books/:bookId/search, /outline (read) and /replace (write)
  if ((isBookSearch || isBookReplace || isBookOutline) && bookId !== undefined) {
    ctx.params.bookId = bookId;
    if (isBookSearch && method === "GET") {
      return chapterController.searchChapters(ctx);
    }
    if (isBookOutline && method === "GET") {
      return chapterController.bookOutline(ctx);
    }
    if (isBookReplace && method === "POST") {
      return afterWrite(chapterController.replaceAllChapters(ctx));
    }
    return jsonResponse(null, 404, "Not Found API");
  }

  // /chapters/:id
  if (isChapterId && chapterId !== undefined) {
    ctx.params.id = chapterId;
    if (method === "GET") return chapterController.getChapter(ctx);
    if (method === "PUT") return afterWrite(chapterController.saveChapter(ctx));
    if (method === "DELETE") return afterWrite(chapterController.deleteChapter(ctx));
    return jsonResponse(null, 404, "Not Found API");
  }

  // /books/:bookId/volumes + /books/:bookId/entries
  if (bookId !== undefined) {
    if (isBookVolumes) {
      ctx.params.bookId = bookId;
      if (method === "GET") return writerController.listVolumes(ctx);
      if (method === "POST") return afterWrite(writerController.createVolume(ctx));
      return jsonResponse(null, 404, "Not Found API");
    }
    if (isBookEntries) {
      ctx.params.bookId = bookId;
      if (method === "GET") return entryController.listEntries(ctx);
      if (method === "POST") return afterWrite(entryController.createEntry(ctx));
      return jsonResponse(null, 404, "Not Found API");
    }
  }

  // /volumes/:id
  if (isVolumeId && chapterId !== undefined) {
    ctx.params.id = chapterId;
    if (method === "PUT") return afterWrite(writerController.renameVolume(ctx));
    if (method === "DELETE") return afterWrite(writerController.deleteVolume(ctx));
    return jsonResponse(null, 404, "Not Found API");
  }

  // /entries/:id
  if (isEntryId && chapterId !== undefined) {
    ctx.params.id = chapterId;
    if (method === "GET") return entryController.getEntry(ctx);
    if (method === "PUT") return afterWrite(entryController.updateEntry(ctx));
    if (method === "DELETE") return afterWrite(entryController.deleteEntry(ctx));
    return jsonResponse(null, 404, "Not Found API");
  }

  // /chapters/:id/volume (move), /chapters/:id/history, /chapters/:id/history/:hid
  if (chapterId !== undefined) {
    if (isChapterVolume) {
      ctx.params.id = chapterId;
      if (method === "PUT") return afterWrite(writerController.moveChapter(ctx));
      return jsonResponse(null, 404, "Not Found API");
    }
    if (isChapterHistory) {
      ctx.params.id = chapterId;
      if (method === "GET") return writerController.chapterHistory(ctx);
      return jsonResponse(null, 404, "Not Found API");
    }
    if (isChapterHistoryItem) {
      const hid = seg(3);
      if (hid !== undefined) {
        ctx.params.id = chapterId;
        ctx.params.hid = hid;
        if (method === "GET") return writerController.historyItem(ctx);
      }
      return jsonResponse(null, 404, "Not Found API");
    }
  }

  // /stats/calendar
  if (isStatsCalendar) {
    if (method === "GET") return writerController.writingCalendar(ctx);
    return jsonResponse(null, 404, "Not Found API");
  }

  return jsonResponse(null, 404, "Not Found API");
}
