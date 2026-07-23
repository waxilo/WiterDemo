import { router } from "./route";
import { corsResponse, jsonResponse } from "./response";

export default {

  async fetch(request, env, ctx) {

    try {

      // 处理跨域预检请求
      if (request.method === "OPTIONS") {
        return corsResponse();
      }

      return await router(
        request,
        env
      );

    } catch (error) {
      return jsonResponse(null, 500, error.message);

    }

  }

};