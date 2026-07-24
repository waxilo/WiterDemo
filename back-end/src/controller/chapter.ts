import * as chapterService from "../service/ChapterService";
import { jsonResponse } from "../response";
import type { Ctx } from "../context";

interface CreateChapterBody {
  title?: string;
}

interface SaveChapterBody {
  title: string;
  content: string;
  hash?: string;
}

export async function listChapters(ctx: Ctx): Promise<Response> {
  const chapters = await chapterService.listChapters(
    ctx.env,
    ctx.userId,
    Number(ctx.params.bookId)
  );
  return jsonResponse(chapters);
}

export async function createChapter(ctx: Ctx): Promise<Response> {
  const body = await ctx
    .json<CreateChapterBody>()
    .catch(() => ({} as CreateChapterBody));
  const chapter = await chapterService.createChapter(
    ctx.env,
    ctx.userId,
    Number(ctx.params.bookId),
    body.title
  );
  return jsonResponse(chapter);
}

export async function getChapter(ctx: Ctx): Promise<Response> {
  const chapter = await chapterService.getChapter(
    ctx.env,
    ctx.userId,
    Number(ctx.params.id)
  );
  return jsonResponse(chapter);
}

export async function saveChapter(ctx: Ctx): Promise<Response> {
  const body = await ctx.json<SaveChapterBody>();
  const chapter = await chapterService.saveChapter(
    ctx.env,
    ctx.userId,
    Number(ctx.params.id),
    { title: body.title, content: body.content, hash: body.hash }
  );
  return jsonResponse(chapter);
}

export async function deleteChapter(ctx: Ctx): Promise<Response> {
  const result = await chapterService.deleteChapter(
    ctx.env,
    ctx.userId,
    Number(ctx.params.id)
  );
  return jsonResponse(result);
}
