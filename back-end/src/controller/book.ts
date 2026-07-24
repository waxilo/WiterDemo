import * as bookService from "../service/BookService";
import { jsonResponse } from "../response";
import type { Ctx } from "../context";

interface BookBody {
  title?: string;
}

export async function listBooks(ctx: Ctx): Promise<Response> {
  const books = await bookService.listBooks(ctx.env, ctx.userId);
  return jsonResponse(books);
}

export async function createBook(ctx: Ctx): Promise<Response> {
  const body = await ctx.json<BookBody>().catch(() => ({} as BookBody));
  const book = await bookService.createBook(ctx.env, ctx.userId, body.title);
  return jsonResponse(book);
}

export async function renameBook(ctx: Ctx): Promise<Response> {
  const body = await ctx.json<BookBody>();
  const book = await bookService.renameBook(
    ctx.env,
    ctx.userId,
    Number(ctx.params.id),
    body.title ?? ""
  );
  return jsonResponse(book);
}

export async function deleteBook(ctx: Ctx): Promise<Response> {
  const result = await bookService.deleteBook(
    ctx.env,
    ctx.userId,
    Number(ctx.params.id)
  );
  return jsonResponse(result);
}
