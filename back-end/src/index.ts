import { router } from "./route";
import { corsResponse, jsonResponse } from "./response";
import { createContext } from "./context";

/** Map known business error messages to response codes. */
function codeForError(message: string): number {
  if (message === "无权操作") return 403;
  if (message === "章节不存在" || message === "书籍不存在") return 404;
  if (message === "账号密码错误") return 400;
  return 500;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight.
    if (request.method === "OPTIONS") {
      return corsResponse();
    }

    try {
      const ctx = createContext(request, env);
      return await router(ctx);
    } catch (error) {
      const message = error instanceof Error ? error.message : "服务端异常";
      return jsonResponse(null, codeForError(message), message);
    }
  },
} satisfies ExportedHandler<Env>;
