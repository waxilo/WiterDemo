import { login } from "./controller/login";
import { checkAuth } from "./middleware/auth";


export async function router(request, env) {

  const url = new URL(request.url);

  const path = url.pathname;
  const method = request.method;


  // 登录不需要token
  if (method === "POST" && path === "/login") {
    return login(
      request,
      env
    );
  }


  // 其他接口校验token
  const auth = await checkAuth(request, env);

  if (!auth.success) {

    return Response.json({
      code: 401,
      message: auth.message
    }, {
      status: 401
    });

  }


  return Response.json({
    code: 404,
    message: "Not Found API"
  });

}